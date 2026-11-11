// The Mendix toolchain's Jest config, with Babel instead of SWC as the transform.
//
// `pluggable-widgets-tools test:unit:web` compiles tests with @swc/jest, whose
// native addon refuses to load on Windows machines where an ancestor of its
// cache directory lets other users replace files (the default ACL on C:\):
// "SWC native addon: user cache failed ... DACL grants replacement rights".
// Babel needs no native code, so `npm test` works everywhere.
const base = require("@mendix/pluggable-widgets-tools/test-config/jest.config.js");

module.exports = {
    ...base,
    collectCoverage: false,
    transform: {
        "^.+.jsx?$": [
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
    // React Email and Tiptap ship ESM; the editor itself is mocked in the tests,
    // but its helpers still have to be transformed when imported.
    transformIgnorePatterns: ["/node_modules/(?!(@react-email|react-email|@tiptap)/)"]
};
