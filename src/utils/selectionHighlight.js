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
 *
 * Done with a decoration rather than by touching the DOM: ProseMirror owns the
 * editor's DOM and would treat a changed class as an edit to read back.
 *
 * The outline shows once the editor is in use: when it has focus (React Email
 * focuses it as soon as a template loads, before this plugin is registered, so
 * that is checked on registration too), and on any click or key press in it.
 * Until then a template opened read-only is not shown with a block marked.
 */
function activate(view) {
    if (!selectionHighlightKey.getState(view.state)?.active) {
        view.dispatch(view.state.tr.setMeta(selectionHighlightKey, { active: true }).setMeta("addToHistory", false));
    }
    return false;
}

export function createSelectionHighlight() {
    return new Plugin({
        key: selectionHighlightKey,
        state: {
            init: () => ({ active: false }),
            apply: (tr, value) => tr.getMeta(selectionHighlightKey) ?? value
        },
        props: {
            decorations(state) {
                if (!selectionHighlightKey.getState(state)?.active) {
                    return null;
                }
                const block = findSelectedBlock(state);
                if (!block) {
                    return null;
                }
                return DecorationSet.create(state.doc, [
                    Decoration.node(block.from, block.to, { class: SELECTED_NODE_CLASS })
                ]);
            },
            handleDOMEvents: {
                focus: activate,
                mousedown: activate,
                keydown: activate
            }
        },
        view(editorView) {
            // Dispatching while the plugin is being installed is not allowed,
            // so look at the focus a moment later.
            const timer = setTimeout(() => {
                if (!editorView.isDestroyed && editorView.hasFocus()) {
                    activate(editorView);
                }
            }, 0);
            return { destroy: () => clearTimeout(timer) };
        }
    });
}
