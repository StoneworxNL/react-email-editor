import { EditorState, NodeSelection, TextSelection } from "@tiptap/pm/state";
import {
    SELECTED_NODE_CLASS,
    createSelectionHighlight,
    findSelectedBlock,
    selectionHighlightKey
} from "./selectionHighlight";
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
    it("marks nothing until the user has been in the editor", () => {
        const { plugin, state } = stateWith(doc => TextSelection.create(doc, posOfText(doc, "Left")));
        expect(decorations(plugin, state)).toEqual([]);
    });

    it("then outlines the block around the cursor, and follows it", () => {
        const { plugin, state } = stateWith(doc => TextSelection.create(doc, posOfText(doc, "Left")));
        const active = state.apply(state.tr.setMeta(selectionHighlightKey, { active: true }));

        const [first] = decorations(plugin, active);
        expect(first.type.attrs.class).toBe(SELECTED_NODE_CLASS);
        expect(active.doc.nodeAt(first.from).textContent).toBe("Left");

        const right = TextSelection.create(active.doc, posOfText(active.doc, "Right"));
        const moved = active.apply(active.tr.setSelection(right));
        const [second] = decorations(plugin, moved);
        expect(moved.doc.nodeAt(second.from).textContent).toBe("Right");
    });

    it("switches on when the editor gets focus, once", () => {
        const { plugin, state } = stateWith(doc => TextSelection.create(doc, 3));
        const view = { state };
        view.dispatch = jest.fn(tr => {
            view.state = view.state.apply(tr);
        });

        expect(plugin.props.handleDOMEvents.focus(view)).toBe(false);
        plugin.props.handleDOMEvents.focus(view);
        expect(view.dispatch).toHaveBeenCalledTimes(1);
        expect(selectionHighlightKey.getState(view.state).active).toBe(true);
    });
});
