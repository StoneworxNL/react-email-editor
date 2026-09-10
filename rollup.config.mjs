import commonjs from "@rollup/plugin-commonjs";

// Dynamic imports have to be gone by the time Mendix bundles the client.
//
// `inlineDynamicImports` folds away the ones with a static specifier. It cannot
// touch one whose specifier is computed, and React Email's code-block extension
// has exactly one of those: it lazy-loads a Prism grammar per language. That
// call survives into the widget bundle, and Mendix's own bundler then refuses
// the whole app:
//
//   (plugin rollup-plugin-mendix-resolve) Error: invalid import "undefined".
//   A file extension must be included in the static part of the import.
//
// because its dynamicImportToGlob() turns the specifier into
// `prismjs/components/prism-*`, whose extname() is empty.

// The ESM build of @react-email/editor writes this as
//   import(/* @vite-ignore */ `prismjs/components/prism-${language}`)
// and the CJS build without the comment, so allow comments and newlines around
// the specifier rather than assuming it sits flush against the parenthesis.
/* eslint-disable-next-line no-template-curly-in-string */
const PRISM_IMPORT = /import\(\s*(?:\/\*[\s\S]*?\*\/\s*)*`prismjs\/components\/prism-\$\{[^`]*\}`\s*\)/g;

const PRISM_STUB = 'Promise.reject(new Error("prism language not bundled"))';

/**
 * Every dynamic import in a chunk whose specifier is not a plain string.
 *
 * This has to be an AST walk rather than a regex. Mendix 10's babel target
 * downlevels the template literal above into `"prefix".concat(x)`, which starts
 * with a quote and sails past any pattern that looks for a backtick or an
 * identifier — while Mendix's own bundler still resolves it, via its
 * CallExpression/.concat branch, to the same unusable glob.
 */
function computedDynamicImports(ast) {
    const offenders = [];
    const stack = [ast];

    while (stack.length) {
        const node = stack.pop();
        if (!node || typeof node !== "object") {
            continue;
        }
        if (Array.isArray(node)) {
            stack.push(...node);
            continue;
        }
        if (node.type === "ImportExpression" && node.source && node.source.type !== "Literal") {
            offenders.push({ type: node.source.type, start: node.start, end: node.end });
        }
        for (const key of Object.keys(node)) {
            if (key !== "type" && key !== "start" && key !== "end" && key !== "loc") {
                stack.push(node[key]);
            }
        }
    }

    return offenders;
}

// Tiptap ships its dist already transpiled — the files import { jsx } from
// "@tiptap/core/jsx-runtime" and call it, so no JSX is left — but they still
// carry the `@jsxImportSource @tiptap/core` comment from their .tsx source.
// Mendix 10 runs @babel/plugin-transform-react-jsx over node_modules with the
// classic runtime, and the plugin rejects that pragma on sight:
//
//   SyntaxError: importSource cannot be set when runtime is classic
//
// The comment is the entire problem, so drop it. This has to run before babel,
// which is why the plugin is prepended rather than appended.
const JSX_IMPORT_SOURCE_PRAGMA = /\/\*+\s*@jsxImportSource\s+\S+\s*\*\//g;

function dropJsxImportSourcePragma() {
    return {
        name: "drop-jsx-import-source-pragma",

        transform(code, id) {
            if (!id.includes("node_modules") || !code.includes("@jsxImportSource")) {
                return null;
            }
            return { code: code.replace(JSX_IMPORT_SOURCE_PRAGMA, ""), map: null };
        }
    };
}

// Mendix lists externals as regexes (/^react$/, /^mendix($|\/)/, …), which is
// also how its commonjs `ignore` callback tests them. Match that exactly rather
// than trying to recover module names from the patterns.
const REQUIRE_CALL = /\brequire\(\s*["']([^"']+)["']\s*\)/g;

function externalMatcher(externals) {
    const matchers = externals.map(value => (value instanceof RegExp ? value : new RegExp(value)));
    return id => matchers.some(matcher => matcher.test(id));
}

/**
 * Let @rollup/plugin-commonjs convert `require()` of external modules.
 *
 * Mendix configures the plugin with
 *
 *   ignore: id => (config.external || []).some(v => new RegExp(v).test(id))
 *
 * so `require("react")` inside a CommonJS dependency is left in the output
 * verbatim. That is right for the AMD bundle, where a `require` exists, and
 * fatal for the ESM bundle the Mendix React client actually loads: the page
 * dies on load with `ReferenceError: require is not defined`. It gets here
 * through @tiptap/react → use-sync-external-store, which is CJS-only, and
 * through react-dom/server.
 *
 * So rebuild the plugin with the same options minus that one. They are copied
 * from configs/rollup.config.mjs, where `extensions` is a fixed constant rather
 * than anything derived from this widget.
 *
 * Rewriting the dependencies instead — injecting an ESM import and pointing the
 * require at it — looks simpler and is wrong: it makes the plugin treat those
 * files as mixed ES modules, so it stops wrapping them in a CommonJS scope, and
 * the bundle trades `require is not defined` for `exports is not defined`.
 */
function useCommonjsThatConvertsExternals(plugins) {
    const index = plugins.findIndex(plugin => plugin && plugin.name === "commonjs");
    if (index === -1) {
        throw new Error(
            "rollup.config.mjs expected a plugin named 'commonjs' in the Mendix config and found " +
                "none. Check configs/rollup.config.mjs in @mendix/pluggable-widgets-tools."
        );
    }

    const patched = [...plugins];
    patched[index] = commonjs({
        extensions: [".js", ".jsx", ".tsx", ".ts"],
        transformMixedEsModules: true,
        requireReturnsDefault: "auto"
    });
    return patched;
}

/**
 * Replace React Email's lazy Prism language import with a rejected promise.
 *
 * Nothing is lost that was not already lost: the languages Prism bundles are
 * registered up front, and for the rest the import could never resolve inside a
 * Mendix bundle anyway. The call site handles the rejection — it drops the
 * language from the pending set, and the surrounding try/catch falls back to
 * highlighting the block as JavaScript.
 */
function stubPrismLanguageImport() {
    return {
        name: "stub-prism-language-import",

        transform(code) {
            PRISM_IMPORT.lastIndex = 0;
            if (!PRISM_IMPORT.test(code)) {
                return null;
            }
            return { code: code.replace(PRISM_IMPORT, PRISM_STUB), map: null };
        }
    };
}

/**
 * Fail the widget build on the two output shapes Mendix cannot consume.
 *
 * Both have already cost a debugging session apiece, and neither is visible in
 * the widget build's own output — they surface much later, either as an
 * app-wide build error that names no widget, or as a blank page with a stack
 * trace pointing into a minified page chunk. Catch them here, where the message
 * can say which widget and which line.
 */
function guardBundleOutput(externals) {
    const isExternal = externalMatcher(externals);

    return {
        name: "guard-bundle-output",

        renderChunk(code, chunk, options) {
            const computed = computedDynamicImports(this.parse(code));
            if (computed.length) {
                const shown = computed
                    .slice(0, 5)
                    .map(o => `  [${o.type}] ${code.slice(o.start, Math.min(o.end, o.start + 160))}`)
                    .join("\n");
                this.error(
                    `${chunk.fileName} contains ${computed.length} dynamic import(s) with a computed ` +
                        "specifier. Mendix's bundler cannot resolve one, so the app will not build — " +
                        'it fails with \'invalid import "undefined"\'. Stub each one out in ' +
                        `rollup.config.mjs the way the Prism language import is:\n${shown}`
                );
            }

            // Only in ESM output. The Studio Pro preview bundle is CommonJS, and
            // there require("react") is simply how rollup emits an external.
            const leftover = new Set();
            if (options.format === "es" || options.format === "esm" || options.format === "module") {
                REQUIRE_CALL.lastIndex = 0;
                for (const [, module_] of code.matchAll(REQUIRE_CALL)) {
                    if (isExternal(module_)) {
                        leftover.add(module_);
                    }
                }
            }
            if (leftover.size) {
                this.error(
                    `${chunk.fileName} contains unconverted require() call(s) for external module(s): ` +
                        `${[...leftover].join(", ")}. There is no require in the ESM bundle the Mendix ` +
                        "React client loads, so the page dies on load with 'ReferenceError: require is " +
                        "not defined'. The import-externals-instead-of-require plugin should have " +
                        "rewritten these."
                );
            }

            return null;
        }
    };
}

export default args =>
    args.configDefaultConfig.map(config => {
        config.output.inlineDynamicImports = true;
        // Both rewrites must see the source as its author wrote it, so they run
        // ahead of babel. The Prism stub in particular: babel's Mendix 10 target
        // turns the template literal into a .concat() call, which the pattern
        // below would no longer recognise. The guard is a renderChunk hook, so
        // it still runs last regardless of where the plugin sits.
        const externals = Array.isArray(config.external) ? config.external : [];
        config.plugins = [
            dropJsxImportSourcePragma(),
            stubPrismLanguageImport(),
            ...useCommonjsThatConvertsExternals(config.plugins || []),
            guardBundleOutput(externals)
        ];
        return config;
    });
