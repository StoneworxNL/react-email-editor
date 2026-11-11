import { describeNodeAt, humanize, nodeLabel, textSnippet } from "./nodeLabels";
import { posOfType, sampleDoc } from "../__tests__/emailSchema";

describe("nodeLabel", () => {
    it.each([
        ["container", "Email"],
        ["twoColumns", "2 columns"],
        ["threeColumns", "3 columns"],
        ["fourColumns", "4 columns"],
        ["paragraph", "Text"],
        ["horizontalRule", "Divider"],
        ["body", "Body"]
    ])("names %s as %s", (type, label) => {
        expect(nodeLabel(type)).toBe(label);
    });

    it("includes the heading level", () => {
        expect(nodeLabel("heading", { level: 3 })).toBe("Heading 3");
        expect(nodeLabel("heading")).toBe("Heading");
    });

    it("says which column it is", () => {
        expect(nodeLabel("columnsColumn", {}, { index: 1, siblings: 3 })).toBe("Column 2 of 3");
        expect(nodeLabel("columnsColumn")).toBe("Column");
    });

    it("names unknown types from their type name rather than as Element", () => {
        expect(nodeLabel("socialLinks")).toBe("Social links");
    });
});

describe("humanize", () => {
    it.each([
        ["previewText", "Preview text"],
        ["table_header", "Table header"],
        ["", "Element"],
        [undefined, "Element"]
    ])("turns %s into %s", (input, output) => {
        expect(humanize(input)).toBe(output);
    });
});

describe("textSnippet", () => {
    it("quotes short text and collapses whitespace", () => {
        expect(textSnippet("  Hello \n world ")).toBe("“Hello world”");
    });

    it("shortens long text", () => {
        const snippet = textSnippet("a".repeat(100));
        expect(snippet.length).toBeLessThanOrEqual(42);
        expect(snippet.endsWith("…”")).toBe(true);
    });

    it("is empty without text", () => {
        expect(textSnippet("   ")).toBe("");
        expect(textSnippet(undefined)).toBe("");
    });
});

describe("describeNodeAt", () => {
    const doc = sampleDoc();

    it("numbers columns from their place in the layout", () => {
        expect(describeNodeAt(doc, "columnsColumn", {}, posOfType(doc, "columnsColumn", 1))).toEqual({
            label: "Column 2 of 2",
            snippet: "“Right”"
        });
    });

    it("adds a snippet of the block's text", () => {
        const { label, snippet } = describeNodeAt(doc, "paragraph", {}, posOfType(doc, "paragraph"));
        expect(label).toBe("Text");
        expect(snippet).toMatch(/^“Thank you for your order/);
    });

    it("survives a position that no longer exists", () => {
        expect(describeNodeAt(doc, "paragraph", {}, 9999)).toEqual({ label: "Text", snippet: "" });
        expect(describeNodeAt(undefined, "body", {}, 0)).toEqual({ label: "Body", snippet: "" });
    });
});
