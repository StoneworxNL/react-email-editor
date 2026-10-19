import { Inspector } from "@react-email/editor/ui";
import { describeNodeAt } from "../utils/nodeLabels";
import { useCurrentEditor } from "@tiptap/react";

/**
 * The style panel's path to the selected block, with names a modeller can
 * recognise. Replaces the inspector's default breadcrumb, which shows "Element"
 * for columns and the email container and hides the middle of long paths.
 * Every step except the last selects that block when clicked.
 */
export function NodeBreadcrumb() {
    const { editor } = useCurrentEditor();

    return (
        <Inspector.Breadcrumb>
            {segments => {
                if (!segments.length) {
                    return null;
                }
                const doc = editor?.state.doc;
                const described = segments.map(segment =>
                    describeNodeAt(doc, segment.node.nodeType, segment.node.nodeAttrs, segment.node.nodePos.pos)
                );
                const current = described[described.length - 1];

                return (
                    <nav aria-label="Selected element" className="mxre-breadcrumb" data-re-inspector-breadcrumb="">
                        <ol data-re-inspector-breadcrumb-list="">
                            {segments.map((segment, index) => {
                                const isLast = index === segments.length - 1;
                                const { label, snippet } = described[index];
                                return (
                                    <li
                                        data-re-inspector-breadcrumb-item=""
                                        key={`${index}-${segment.node.nodePos.pos}`}
                                    >
                                        {index > 0 ? <span data-re-inspector-breadcrumb-separator="">/</span> : null}
                                        <button
                                            aria-current={isLast ? "location" : undefined}
                                            className={isLast ? "mxre-breadcrumb-current" : undefined}
                                            data-re-inspector-breadcrumb-button=""
                                            {...(isLast ? {} : { "data-clickable": "" })}
                                            onClick={() => segment.focus()}
                                            title={snippet ? `${label} ${snippet}` : label}
                                            type="button"
                                        >
                                            {label}
                                        </button>
                                    </li>
                                );
                            })}
                        </ol>
                        {current.snippet ? <p className="mxre-breadcrumb-snippet">{current.snippet}</p> : null}
                    </nav>
                );
            }}
        </Inspector.Breadcrumb>
    );
}
