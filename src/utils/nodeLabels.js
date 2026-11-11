/**
 * Readable names for the blocks of an email, for the style panel's path.
 *
 * React Email's inspector names only some node types and calls the rest
 * "Element", which is what the email container and every column layout end up
 * as. A modeller then sees "Body / Element / Element" and cannot tell what is
 * selected. These names, plus the position of a column and a snippet of the
 * text, make each step of the path recognisable.
 */

const LABELS = {
    body: "Body",
    container: "Email",
    paragraph: "Text",
    image: "Image",
    button: "Button",
    link: "Link",
    codeBlock: "Code block",
    section: "Section",
    div: "Container",
    footer: "Footer",
    blockquote: "Quote",
    bulletList: "Bullet list",
    orderedList: "Numbered list",
    listItem: "List item",
    table: "Table",
    tableRow: "Table row",
    tableCell: "Table cell",
    tableHeader: "Table header",
    horizontalRule: "Divider",
    twoColumns: "2 columns",
    threeColumns: "3 columns",
    fourColumns: "4 columns",
    global: "Layout"
};

const SNIPPET_LENGTH = 40;

/** `someNodeType` -> "Some node type", for node types added later. */
export function humanize(nodeType) {
    const words = String(nodeType ?? "")
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .trim()
        .toLowerCase();
    return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Element";
}

/**
 * The short name of one node: "Heading 2", "Column 1 of 3", "Email".
 *
 * `context` is optional: `index` and `siblings` are the node's position among
 * its parent's children, which is what tells two columns apart.
 */
export function nodeLabel(nodeType, attrs = {}, context = {}) {
    if (nodeType === "heading") {
        return attrs.level ? `Heading ${attrs.level}` : "Heading";
    }
    if (nodeType === "columnsColumn") {
        const { index, siblings } = context;
        if (Number.isInteger(index) && Number.isInteger(siblings) && siblings > 0) {
            return `Column ${index + 1} of ${siblings}`;
        }
        return "Column";
    }
    return LABELS[nodeType] ?? humanize(nodeType);
}

/** The first words of a node's text, quoted, or "" when it has none. */
export function textSnippet(text) {
    const clean = String(text ?? "")
        .replace(/\s+/g, " ")
        .trim();
    if (!clean) {
        return "";
    }
    return clean.length > SNIPPET_LENGTH ? `“${clean.slice(0, SNIPPET_LENGTH - 1).trimEnd()}…”` : `“${clean}”`;
}

/**
 * Describe the node at a document position: its label and text snippet.
 * Tolerates a position that no longer exists, which happens for a moment after
 * the document changes under the inspector.
 */
export function describeNodeAt(doc, nodeType, attrs, pos) {
    let context = {};
    let text = "";
    if (doc && Number.isInteger(pos) && pos >= 0 && pos < doc.content.size) {
        try {
            const resolved = doc.resolve(pos);
            const node = doc.nodeAt(pos);
            context = { index: resolved.index(), siblings: resolved.parent.childCount };
            text = node?.textContent ?? "";
        } catch {
            // Position out of date: fall back to the bare label.
        }
    }
    return { label: nodeLabel(nodeType, attrs, context), snippet: textSnippet(text) };
}
