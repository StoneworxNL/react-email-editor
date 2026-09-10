const base = require("@mendix/pluggable-widgets-tools/configs/eslint.js.base.json");

module.exports = {
    ...base,
    rules: {
        ...base.rules,
        // Prettier owns formatting in this widget, and it writes `async (x) =>`
        // with a space. The Mendix 10 base config extends "prettier" and then
        // re-enables space-before-function-paren: ["error", "never"] in `rules`,
        // which wins over the extends — so the two contradict each other and
        // `lint:fix` cannot converge: prettier adds the space, eslint rejects it.
        // Prettier wins.
        "space-before-function-paren": "off"
    }
};
