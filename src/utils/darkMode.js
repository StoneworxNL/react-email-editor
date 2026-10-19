/**
 * Dark mode for the sent email.
 *
 * React Email renders every style inline and gives elements no classes, so a
 * dark colour scheme cannot be expressed as a theme. Instead the rendered HTML
 * is post-processed: each element gets a class naming its role, and a style
 * block maps those roles to dark colours under `prefers-color-scheme: dark`,
 * with `!important` to win over the inline light colours. Mail apps that honour
 * the email's own dark styles (Apple Mail, Outlook for Mac, Outlook.com via its
 * data-ogsc/data-ogsb attributes) then show the designed dark version. Apps that
 * recolour emails themselves (Gmail, Outlook for Windows) ignore all of this;
 * the preview's simulated dark view is for those.
 */

/** Theme parts a dark colour can be set for, and the CSS properties allowed. */
export const DARK_PARTS = {
    body: ["backgroundColor", "color"],
    container: ["backgroundColor", "color", "borderColor"],
    surface: ["backgroundColor", "color", "borderColor"],
    h1: ["color"],
    h2: ["color"],
    h3: ["color"],
    paragraph: ["color"],
    link: ["color"],
    button: ["backgroundColor", "color", "borderColor"],
    divider: ["borderColor"]
};

const CSS_NAMES = { backgroundColor: "background-color", color: "color", borderColor: "border-color" };

const PREFIX = "rem-dark-";

/** A colour value that cannot break out of a CSS declaration. */
function isSafeColour(value) {
    return typeof value === "string" && /^[#a-zA-Z0-9(),.%\s-]{1,64}$/.test(value);
}

/**
 * Validate the "dark" part of the theme configuration.
 * Returns `{ dark, error }`: `dark` is null when there is nothing to apply.
 */
export function readDarkColours(config) {
    if (config === undefined || config === null) {
        return { dark: null, error: null };
    }
    if (typeof config !== "object" || Array.isArray(config)) {
        return { dark: null, error: 'The "dark" theme setting must be a JSON object.' };
    }
    const dark = {};
    const problems = [];
    for (const [part, props] of Object.entries(config)) {
        const allowed = DARK_PARTS[part];
        if (!allowed) {
            problems.push(`unknown part "${part}"`);
            continue;
        }
        if (!props || typeof props !== "object" || Array.isArray(props)) {
            problems.push(`"${part}" must be an object`);
            continue;
        }
        for (const [prop, value] of Object.entries(props)) {
            if (!allowed.includes(prop)) {
                problems.push(`"${part}.${prop}" is not supported`);
            } else if (!isSafeColour(value)) {
                problems.push(`"${part}.${prop}" is not a colour`);
            } else {
                dark[part] = { ...dark[part], [prop]: value.trim() };
            }
        }
    }
    if (problems.length) {
        return {
            dark: null,
            error: `Dark theme colours ignored: ${problems.join(", ")}. Parts: ${Object.keys(DARK_PARTS).join(", ")}.`
        };
    }
    return { dark: Object.keys(dark).length ? dark : null, error: null };
}

function hasInline(element, property) {
    return new RegExp(`(^|;)\\s*${property}\\s*:`, "i").test(element.getAttribute("style") ?? "");
}

/** Give each element of the rendered email a class naming its role. */
function tagRoles(doc) {
    const tag = (element, part) => element.classList.add(PREFIX + part);

    tag(doc.body, "body");
    for (const element of doc.body.querySelectorAll("[style]")) {
        const name = element.tagName.toLowerCase();
        const style = element.getAttribute("style") ?? "";
        if (/max-width\s*:\s*\d/i.test(style) && name === "table") {
            tag(element, "container");
        } else if (name === "h1" || name === "h2" || name === "h3") {
            tag(element, name);
        } else if (name === "p" || name === "li") {
            tag(element, "paragraph");
        } else if (name === "a") {
            tag(element, hasInline(element, "background-color") ? "button" : "link");
        } else if (name === "hr") {
            tag(element, "divider");
        } else if (hasInline(element, "background-color")) {
            // The first such cell carries the body background; later ones are panels.
            tag(element, element.closest(`.${PREFIX}container`) ? "surface" : "body");
        }
    }
}

/** The CSS rules for the dark colours, without the media query around them. */
export function darkRules(dark) {
    const rules = [];
    for (const [part, props] of Object.entries(dark ?? {})) {
        const declarations = Object.entries(props)
            .map(([prop, value]) => `${CSS_NAMES[prop]}:${value} !important`)
            .join(";");
        rules.push(`.${PREFIX}${part}{${declarations}}`);
        // Outlook.com and the Outlook apps mark their dark mode with attributes.
        const colour = props.color ? `color:${props.color} !important` : "";
        const background = props.backgroundColor ? `background-color:${props.backgroundColor} !important` : "";
        if (colour) {
            rules.push(`[data-ogsc] .${PREFIX}${part}{${colour}}`);
        }
        if (background) {
            rules.push(`[data-ogsb] .${PREFIX}${part}{${background}}`);
        }
    }
    return rules;
}

function parse(html) {
    return new DOMParser().parseFromString(html, "text/html");
}

function serialize(doc, originalHtml) {
    const doctype = /^\s*<!DOCTYPE[^>]*>/i.exec(originalHtml)?.[0] ?? "<!DOCTYPE html>";
    return `${doctype}\n${doc.documentElement.outerHTML}`;
}

function addHeadElement(doc, name, attributes, text) {
    const element = doc.createElement(name);
    for (const [key, value] of Object.entries(attributes)) {
        element.setAttribute(key, value);
    }
    if (text) {
        element.textContent = text;
    }
    doc.head.appendChild(element);
    return element;
}

/**
 * Add the dark colours to a rendered email: role classes, the `color-scheme`
 * meta tags mail apps look for, and the dark rules. Returns the HTML unchanged
 * when there are no dark colours or nothing to parse.
 */
export function applyDarkMode(html, dark) {
    if (!dark || typeof html !== "string" || html.trim() === "") {
        return html;
    }
    const doc = parse(html);
    if (!doc.body) {
        return html;
    }
    tagRoles(doc);
    addHeadElement(doc, "meta", { name: "color-scheme", content: "light dark" });
    addHeadElement(doc, "meta", { name: "supported-color-schemes", content: "light dark" });
    addHeadElement(
        doc,
        "style",
        {},
        `:root{color-scheme:light dark;supported-color-schemes:light dark}` +
            `@media (prefers-color-scheme: dark){${darkRules(dark).join("")}}`
    );
    return serialize(doc, html);
}

/**
 * For the preview's dark view: the email as a dark-mode mail app shows it.
 *
 * With dark colours set, the designed dark version, forced on regardless of
 * the viewer's own setting. Without them, an approximation of the apps that
 * invert colours themselves, so problems such as a logo that disappears on a
 * dark background show up before sending.
 */
export function darkPreviewHtml(html, dark) {
    if (typeof html !== "string" || html.trim() === "") {
        return html;
    }
    const doc = parse(dark ? applyDarkMode(html, dark) : html);
    const css = dark
        ? darkRules(dark).join("")
        : "html{filter:invert(1) hue-rotate(180deg);background:#fff}" +
          "img,picture,video,[style*='background-image']{filter:invert(1) hue-rotate(180deg)}";
    addHeadElement(doc, "style", { "data-preview": "dark" }, `:root{color-scheme:dark}${css}`);
    return serialize(doc, html);
}
