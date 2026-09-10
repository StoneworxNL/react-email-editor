const PRESETS = ["basic", "minimal"];

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
 * Turn the two theme properties into the `theme` prop of `<EmailEditor>`.
 *
 * A broken custom theme falls back to `basic` and reports why, rather than
 * letting the editor fail to mount.
 */
export function resolveTheme(preset, configJson) {
    if (preset !== "custom") {
        return { theme: PRESETS.includes(preset) ? preset : "basic", error: null };
    }

    const raw = typeof configJson === "string" ? configJson.trim() : "";
    if (raw === "") {
        return { theme: "basic", error: null };
    }

    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (error) {
        return { theme: "basic", error: `Theme configuration is not valid JSON: ${error.message}` };
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { theme: "basic", error: "Theme configuration must be a JSON object." };
    }

    const styles = parsed.styles ?? parsed;
    if (!styles || typeof styles !== "object" || Array.isArray(styles)) {
        return { theme: "basic", error: 'Theme configuration needs a "styles" object.' };
    }

    const unknown = Object.keys(styles).filter(key => !THEMEABLE.includes(key));
    if (unknown.length) {
        return {
            theme: "basic",
            error: `Theme configuration has unknown parts: ${unknown.join(", ")}. Allowed: ${THEMEABLE.join(", ")}.`
        };
    }

    const base = PRESETS.includes(parsed.extends) ? parsed.extends : "basic";
    return { theme: { extends: base, styles }, error: null };
}
