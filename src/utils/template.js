import { readListAttribute } from "./mendix";

/**
 * Parse the stored template document.
 *
 * The editor's own JSON is the only representation that round-trips without
 * loss, so that is what we persist and reload. Returns `null` when the string
 * is empty or is not a usable ProseMirror document, so the caller can fall back
 * to importing HTML.
 */
export function parseDocument(raw) {
    if (typeof raw !== "string" || raw.trim() === "") {
        return null;
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return null;
    }
    if (parsed.type !== "doc" || !Array.isArray(parsed.content)) {
        return null;
    }
    return parsed;
}

/** Stable string form of a document, used for change and dirty detection. */
export function serializeDocument(doc) {
    if (!doc) {
        return "";
    }
    try {
        return JSON.stringify(doc);
    } catch {
        return "";
    }
}

/**
 * Decide what the editor should be loaded with, given the current attribute
 * values. The JSON document wins; the rendered HTML is a fallback so templates
 * that were never edited here can still be imported.
 */
export function resolveSource(documentValue, htmlValue) {
    const json = parseDocument(documentValue);
    if (json) {
        return { kind: "json", content: json, signature: `json:${serializeDocument(json)}` };
    }
    if (typeof htmlValue === "string" && htmlValue.trim() !== "") {
        return { kind: "html", content: htmlValue, signature: `html:${htmlValue}` };
    }
    return { kind: "empty", content: "", signature: "empty:" };
}

/** The text as it appears in rendered HTML: React Email escapes these characters. */
export function escapeHtml(text) {
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The literal token a variable is inserted as, e.g. `{{firstName}}`. */
export function buildToken(prefix, name, suffix) {
    return `${prefix ?? ""}${name}${suffix ?? ""}`;
}

/**
 * Replace every token with its sample value. Used for the preview only; the
 * saved template keeps the tokens. A token built from a name also matches with
 * spaces inside the delimiters, e.g. `{{ firstName }}`.
 */
export function substituteVariables(html, variables) {
    if (typeof html !== "string" || html === "" || !variables.length) {
        return html;
    }
    return variables.reduce((result, variable) => {
        if (variable.sample === undefined) {
            return result;
        }
        // The HTML is rendered, so a token containing <, > or & appears escaped
        // in it: match both forms. The sample is escaped going in, so a "<" in
        // it shows as text instead of breaking the layout.
        const form = escape => {
            const part = text => escapeRegExp(escape(text));
            return variable.name
                ? `${part(variable.prefix)}\\s*${part(variable.name)}\\s*${part(variable.suffix)}`
                : part(variable.token);
        };
        const pattern = new RegExp(`${form(text => text)}|${form(escapeHtml)}`, "g");
        const sample = escapeHtml(variable.sample);
        // A function replacement keeps `$` in sample values literal.
        return result.replace(pattern, () => sample);
    }, html);
}

/**
 * Turn the variables data source into the plain list the UI works with.
 *
 * A Full token, such as a Model Reflection CombinedToken, is inserted exactly
 * as stored; otherwise the token is the name wrapped in the prefix and suffix.
 * Entries with neither are dropped: they could not be inserted anyway.
 */
export function readVariables(datasource, attributes, prefix, suffix) {
    if (!datasource || datasource.status !== "available" || !datasource.items) {
        return [];
    }
    const variables = [];
    for (const item of datasource.items) {
        // A blank Full token falls back to the name rather than inserting spaces.
        const fullToken = readListAttribute(attributes.token, item)?.trim() || undefined;
        const name = fullToken ? undefined : readListAttribute(attributes.name, item);
        if (!fullToken && !name) {
            continue;
        }
        const token = fullToken ?? buildToken(prefix, name, suffix);
        variables.push({
            id: item.id,
            name,
            prefix: prefix ?? "",
            suffix: suffix ?? "",
            token,
            label: readListAttribute(attributes.label, item) ?? name ?? token,
            sample: readListAttribute(attributes.sample, item)
        });
    }
    return variables;
}
