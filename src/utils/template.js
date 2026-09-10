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

function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The literal token a variable is inserted as, e.g. `{{firstName}}`. */
export function buildToken(prefix, name, suffix) {
    return `${prefix ?? ""}${name}${suffix ?? ""}`;
}

/**
 * Replace every `{{name}}` token with its sample value. Used for the preview
 * only; the saved template keeps the tokens.
 */
export function substituteVariables(html, variables, prefix, suffix) {
    if (typeof html !== "string" || html === "" || !variables.length) {
        return html;
    }
    const open = escapeRegExp(prefix ?? "");
    const close = escapeRegExp(suffix ?? "");
    return variables.reduce((result, variable) => {
        if (variable.sample === undefined) {
            return result;
        }
        const pattern = new RegExp(`${open}\\s*${escapeRegExp(variable.name)}\\s*${close}`, "g");
        return result.replace(pattern, variable.sample);
    }, html);
}

/**
 * Turn the variables data source into the plain list the UI works with.
 * Entries without a name are dropped: they could not be inserted anyway.
 */
export function readVariables(datasource, nameAttribute, labelAttribute, sampleAttribute) {
    if (!datasource || datasource.status !== "available" || !datasource.items) {
        return [];
    }
    const variables = [];
    for (const item of datasource.items) {
        const name = readListAttribute(nameAttribute, item);
        if (!name) {
            continue;
        }
        variables.push({
            id: item.id,
            name,
            label: readListAttribute(labelAttribute, item) ?? name,
            sample: readListAttribute(sampleAttribute, item)
        });
    }
    return variables;
}
