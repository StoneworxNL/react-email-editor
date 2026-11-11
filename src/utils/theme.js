import { readDarkColours } from "./darkMode";

const PRESETS = ["basic", "minimal"];

// Top-level keys that are settings rather than themeable parts.
const SETTINGS = ["extends", "styles", "dark"];

const THEMEABLE = [
    "body",
    "container",
    "h1",
    "h2",
    "h3",
    "paragraph",
    "link",
    "image",
    "button",
    "codeBlock",
    "inlineCode"
];

/**
 * Turn the two theme properties into the `theme` prop of `<EmailEditor>`, plus
 * the optional dark colours (`"dark": { "body": { "backgroundColor": … } }`)
 * that are written into the email on save.
 *
 * A broken custom theme falls back to `basic` and reports why, rather than
 * letting the editor fail to mount. Broken dark colours are reported and
 * ignored without affecting the light theme.
 */
export function resolveTheme(preset, configJson) {
    if (preset !== "custom") {
        return { theme: PRESETS.includes(preset) ? preset : "basic", dark: null, error: null };
    }

    const raw = typeof configJson === "string" ? configJson.trim() : "";
    if (raw === "") {
        return { theme: "basic", dark: null, error: null };
    }

    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (error) {
        return { theme: "basic", dark: null, error: `Theme configuration is not valid JSON: ${error.message}` };
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { theme: "basic", dark: null, error: "Theme configuration must be a JSON object." };
    }

    const { dark, error: darkError } = readDarkColours(parsed.dark);

    const styles =
        parsed.styles ?? Object.fromEntries(Object.entries(parsed).filter(([key]) => !SETTINGS.includes(key)));
    if (!styles || typeof styles !== "object" || Array.isArray(styles)) {
        return { theme: "basic", dark, error: 'Theme configuration needs a "styles" object.' };
    }

    const unknown = Object.keys(styles).filter(key => !THEMEABLE.includes(key));
    if (unknown.length) {
        return {
            theme: "basic",
            dark,
            error: `Theme configuration has unknown parts: ${unknown.join(", ")}. Allowed: ${THEMEABLE.join(", ")}.`
        };
    }

    const base = PRESETS.includes(parsed.extends) ? parsed.extends : "basic";
    return { theme: { extends: base, styles }, dark, error: darkError };
}
