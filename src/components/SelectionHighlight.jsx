import { createSelectionHighlight, selectionHighlightKey } from "../utils/selectionHighlight";
import { useCurrentEditor } from "@tiptap/react";
import { useEffect } from "react";

/**
 * Adds the selected-block outline to the editor it is rendered in. Registered
 * as a plugin on the running editor rather than passed as an extension:
 * `<EmailEditor extensions>` replaces React Email's own extensions instead of
 * adding to them.
 */
export function SelectionHighlight() {
    const { editor } = useCurrentEditor();

    useEffect(() => {
        if (!editor || editor.isDestroyed) {
            return undefined;
        }
        editor.registerPlugin(createSelectionHighlight());
        return () => {
            if (!editor.isDestroyed) {
                editor.unregisterPlugin(selectionHighlightKey);
            }
        };
    }, [editor]);

    return null;
}
