import { EditorState, NodeSelection, TextSelection } from "@tiptap/pm/state";
import { SELECTED_NODE_CLASS, createSelectionHighlight, findSelectedBlock } from "./selectionHighlight";
import { posOfText, posOfType, sampleDoc, schema } from "../__tests__/emailSchema";

function stateWith(selectionAt) {
    const doc = sampleDoc();
    const plugin = createSelectionHighlight();
    const state = EditorState.create({ doc, schema, plugins: [plugin] });
    return { plugin, state: state.apply(state.tr.setSelection(selectionAt(doc))) };
}

function decorations(plugin, state) {
    const set = plugin.props.decorations(state);
    return set ? set.find() : [];
}

describe("findSelectedBlock", () => {
    it("is the innermost block around the cursor", () => {
        const { state } = stateWith(doc => TextSelection.create(doc, posOfText(doc, "Right") + 2));
        const block = findSelectedBlock(state);
        expect(state.doc.nodeAt(block.from).type.name).toBe("paragraph");
        expect(state.doc.nodeAt(block.from).textContent).toBe("Right");
    });

    it("is the node itself for a node selection", () => {
        const { state } = stateWith(doc => NodeSelection.create(doc, posOfType(doc, "columnsColumn", 0)));
        const block = findSelectedBlock(state);
        expect(state.doc.nodeAt(block.from).type.name).toBe("columnsColumn");
        expect(block.to - block.from).toBe(state.doc.nodeAt(block.from).nodeSize);
    });
});

describe("selection highlight plugin", () => {
    it("outlines the block holding the selection as soon as the template is loaded", () => {
        const { plugin, state } = stateWith(doc => TextSelection.create(doc, 3));
        const [outline] = decorations(plugin, state);
        expect(outline.type.attrs.class).toBe(SELECTED_NODE_CLASS);
        expect(state.doc.nodeAt(outline.from).type.name).toBe("heading");
    });

    it("follows the cursor", () => {
        const { plugin, state } = stateWith(doc => TextSelection.create(doc, posOfText(doc, "Left")));
        expect(state.doc.nodeAt(decorations(plugin, state)[0].from).textContent).toBe("Left");

        const right = TextSelection.create(state.doc, posOfText(state.doc, "Right"));
        const moved = state.apply(state.tr.setSelection(right));
        const outlines = decorations(plugin, moved);
        expect(outlines).toHaveLength(1);
        expect(moved.doc.nodeAt(outlines[0].from).textContent).toBe("Right");
    });

    it("outlines a selected image", () => {
        const { plugin, state } = stateWith(doc => NodeSelection.create(doc, posOfType(doc, "image")));
        expect(state.doc.nodeAt(decorations(plugin, state)[0].from).type.name).toBe("image");
    });
});
