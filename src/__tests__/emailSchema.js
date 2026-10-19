// A small ProseMirror schema shaped like React Email's: a container holding
// headings, paragraphs and column layouts, for tests that need real documents.
import { Schema } from "@tiptap/pm/model";

export const schema = new Schema({
    nodes: {
        doc: { content: "block+" },
        container: { group: "block", content: "block+" },
        paragraph: { group: "block", content: "inline*" },
        heading: { group: "block", content: "inline*", attrs: { level: { default: 1 } } },
        twoColumns: { group: "block", content: "columnsColumn columnsColumn" },
        columnsColumn: { content: "block+" },
        image: { group: "block", attrs: { src: { default: "" } }, selectable: true },
        text: { group: "inline" }
    }
});

const t = text => schema.text(text);

/** container > [heading, paragraph, twoColumns > [column > p, column > p], image] */
export function sampleDoc() {
    return schema.node("doc", null, [
        schema.node("container", null, [
            schema.node("heading", { level: 2 }, [t("Your order")]),
            schema.node("paragraph", null, [t("Thank you for your order, it is on its way to you very soon now.")]),
            schema.node("twoColumns", null, [
                schema.node("columnsColumn", null, [schema.node("paragraph", null, [t("Left")])]),
                schema.node("columnsColumn", null, [schema.node("paragraph", null, [t("Right")])])
            ]),
            schema.node("image", { src: "a.png" })
        ])
    ]);
}

/** Position just inside the first text that equals `text`. */
export function posOfText(doc, text) {
    let found = -1;
    doc.descendants((node, pos) => {
        if (found === -1 && node.isText && node.text === text) {
            found = pos;
        }
    });
    return found;
}

/** Position of the nth node of a type. */
export function posOfType(doc, typeName, nth = 0) {
    let count = 0;
    let found = -1;
    doc.descendants((node, pos) => {
        if (found === -1 && node.type.name === typeName) {
            if (count === nth) {
                found = pos;
            }
            count += 1;
        }
    });
    return found;
}
