import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { NodeSelection, Plugin, PluginKey } from "@tiptap/pm/state";

export const selectionHighlightKey = new PluginKey("mxreSelectionHighlight");

export const SELECTED_NODE_CLASS = "mxre-selected-node";

/**
 * The block the user is working on: a selected node (an image, a button, a
 * column picked in the style panel's path), or else the innermost block that
 * holds the cursor. Null when there is none.
 */
export function findSelectedBlock(state) {
    const { selection } = state;
    if (selection instanceof NodeSelection) {
        return { from: selection.from, to: selection.to };
    }
    const { $from } = selection;
    for (let depth = $from.depth; depth > 0; depth--) {
        if ($from.node(depth).isBlock) {
            return { from: $from.before(depth), to: $from.after(depth) };
        }
    }
    return null;
}

/**
 * Outline the selected block, so it is clear what the style panel is editing.
 * Always on, from the moment a template loads: the editor always has a
 * selection, and that is also what the style panel shows.
 *
 * Done with a decoration rather than by touching the DOM: ProseMirror owns the
 * editor's DOM and would treat a changed class as an edit to read back.
 */
export function createSelectionHighlight() {
    return new Plugin({
        key: selectionHighlightKey,
        props: {
            decorations(state) {
                const block = findSelectedBlock(state);
                if (!block) {
                    return null;
                }
                return DecorationSet.create(state.doc, [
                    Decoration.node(block.from, block.to, { class: SELECTED_NODE_CLASS })
                ]);
            }
        }
    });
}
