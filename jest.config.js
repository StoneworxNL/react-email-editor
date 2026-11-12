// The Mendix toolchain's Jest config, with Babel instead of SWC as the transform.
//
// `pluggable-widgets-tools test:unit:web` compiles tests with @swc/jest, whose
// native addon refuses to load on Windows machines where an ancestor of its
// cache directory lets other users replace files (the default ACL on C:\):
// "SWC native addon: user cache failed ... DACL grants replacement rights".
// Babel needs no native code, so `npm test` works everywhere.
const { existsSync, readdirSync, readFileSync } = require("fs");
const { join } = require("path");
const base = require("@mendix/pluggable-widgets-tools/test-config/jest.config.js");

/**
 * Top-level packages that ship ES modules only ("type": "module"), so Jest has
 * to transform them. React Email's editor pulls in many (the unified/hast
 * family); listing them by hand would break on every dependency update.
 */
function esmOnlyPackages() {
    const root = join(__dirname, "node_modules");
    if (!existsSync(root)) {
        return [];
    }
    const names = readdirSync(root).flatMap(name =>
        name.startsWith("@") ? readdirSync(join(root, name)).map(scoped => `${name}/${scoped}`) : [name]
    );
    return names.filter(name => {
        try {
            return JSON.parse(readFileSync(join(root, name, "package.json"), "utf8")).type === "module";
        } catch {
            return false;
        }
    });
}

const escape = name => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// React Email and Tiptap ship ESM in .js/.mjs files without "type": "module".
const TRANSFORMED = ["@react-email", "react-email", "@tiptap", ...esmOnlyPackages().map(escape)];

module.exports = {
    ...base,
    collectCoverage: false,
    transform: {
        "^.+.m?jsx?$": [
            "babel-jest",
            {
                babelrc: false,
                configFile: false,
                presets: [
                    ["@babel/preset-env", { targets: { node: "current" } }],
                    ["@babel/preset-react", { runtime: "automatic" }]
                ]
            }
        ]
    },
    transformIgnorePatterns: [`/node_modules/(?!(${TRANSFORMED.join("|")})/)`]
};
