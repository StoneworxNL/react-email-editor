import commonjs from "@rollup/plugin-commonjs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

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
 * Turn rem sizes in React Email's stylesheets into pixels.
 *
 * Those sizes assume the browser default of 16px per rem, but Atlas sets the
 * root font size to 10px, so in a Mendix app the inspector, bubble menus and
 * slash command came out at 62.5% of their size: 12px labels rendered at 7.5px.
 * Fixed pixels make them look the same in any app. The widget's own stylesheet
 * gets the same treatment, so a rem in it means the same as in React Email's.
 */
const REM_IN_PX = 16;
const REM_STYLESHEETS = [/[\\/]@react-email[\\/]editor[\\/].*\.css$/, /[\\/]src[\\/]ui[\\/][^\\/]+\.css$/];

function reactEmailRemToPx() {
    return {
        name: "react-email-rem-to-px",

        transform(code, id) {
            const file = id.split("?")[0];
            if (!REM_STYLESHEETS.some(pattern => pattern.test(file))) {
                return null;
            }
            const converted = code.replace(
                /(^|[^\w.-])(\d*\.?\d+)rem\b/g,
                (_match, before, value) => `${before}${parseFloat((parseFloat(value) * REM_IN_PX).toFixed(3))}px`
            );
            return { code: converted, map: null };
        }
    };
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
                        "it fails with 'invalid import \"undefined\"'. Stub each one out in " +
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

/**
 * Bundle both React builds of react-dom/server and pick one at runtime.
 *
 * The Mendix client supplies react, but react-dom/server is bundled here, and
 * the two must agree on more than the version: development React calls
 * `dispatcher.getOwner()` on the dispatcher the server renderer installs, and
 * only the development renderer provides it. A production widget bundle on a
 * locally run app (development React) fails every render with
 * "dispatcher.getOwner is not a function"; a development bundle would carry
 * the reverse risk on a deployed app. So ship both, and ask React which one it is.
 *
 * The development files hide their body behind `process.env.NODE_ENV`, which the
 * Mendix build replaces with "production". Pin it to "development" in just those
 * files first; this plugin is prepended so it transforms ahead of the replace.
 */
const REACT_DOM_SERVER_IDS = new Set(["react-dom/server", "react-dom/server.browser"]);
const DUAL_SERVER_ID = "\0react-dom-server-dual";

function reactDomServerForEitherReactBuild() {
    // The package's exports map hides cjs/, so resolve from the package root.
    const root = require
        .resolve("react-dom/package.json")
        .replace(/\\/g, "/")
        .replace(/package\.json$/, "");
    const file = name => `${root}cjs/${name}`;
    const builds = {
        prod: file("react-dom-server.browser.production.js"),
        dev: file("react-dom-server.browser.development.js"),
        legacyProd: file("react-dom-server-legacy.browser.production.js"),
        legacyDev: file("react-dom-server-legacy.browser.development.js")
    };
    const developmentFiles = new Set([builds.dev, builds.legacyDev]);

    return {
        name: "react-dom-server-for-either-react-build",

        resolveId(source) {
            return REACT_DOM_SERVER_IDS.has(source) ? DUAL_SERVER_ID : null;
        },

        load(id) {
            if (id !== DUAL_SERVER_ID) {
                return null;
            }
            return `
import * as React from "react";
import prod from ${JSON.stringify(builds.prod)};
import dev from ${JSON.stringify(builds.dev)};
import legacyProd from ${JSON.stringify(builds.legacyProd)};
import legacyDev from ${JSON.stringify(builds.legacyDev)};

// Only development React exposes actQueue on its shared internals.
const internals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
const isDevelopment = Boolean(internals) && "actQueue" in internals;
const server = isDevelopment ? dev : prod;
const legacy = isDevelopment ? legacyDev : legacyProd;

export const version = legacy.version;
export const renderToString = (...args) => legacy.renderToString(...args);
export const renderToStaticMarkup = (...args) => legacy.renderToStaticMarkup(...args);
export const renderToReadableStream = (...args) => server.renderToReadableStream(...args);
export const resume = (...args) => server.resume(...args);
export default { version, renderToString, renderToStaticMarkup, renderToReadableStream, resume };
`;
        },

        transform(code, id) {
            if (!developmentFiles.has(id.replace(/\\/g, "/"))) {
                return null;
            }
            return { code: code.replace(/process\.env\.NODE_ENV/g, '"development"'), map: null };
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
            reactDomServerForEitherReactBuild(),
            reactEmailRemToPx(),
            dropJsxImportSourcePragma(),
            stubPrismLanguageImport(),
            ...useCommonjsThatConvertsExternals(config.plugins || []),
            guardBundleOutput(externals)
        ];
        return config;
    });
