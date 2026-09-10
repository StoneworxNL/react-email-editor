import { CopyIcon, DesktopIcon, MobileIcon, PanelIcon, RedoIcon, RefreshIcon, SaveIcon, UndoIcon } from "./Icons";
import { VariableMenu } from "./VariableMenu";
import classNames from "classnames";
import { createElement } from "react";

const VIEWS = [
    { key: "design", label: "Design" },
    { key: "preview", label: "Preview" },
    { key: "html", label: "HTML" },
    { key: "text", label: "Text" }
];

function ToggleGroup({ children, label }) {
    return (
        <div aria-label={label} className="mxre-toggle-group" role="group">
            {children}
        </div>
    );
}

export function Toolbar({
    view,
    onViewChange,
    showViewSwitcher,
    saveMode,
    dirty,
    saving,
    editable,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    onSave,
    onReload,
    variables,
    variablePrefix,
    variableSuffix,
    onInsertVariable,
    showInspector,
    inspectorOpen,
    onToggleInspector,
    previewWidth,
    onPreviewWidthChange,
    onCopy,
    copied
}) {
    const isDesign = view === "design";
    const isPreview = view === "preview";
    const isCode = view === "html" || view === "text";

    return (
        <div className="mxre-toolbar">
            <div className="mxre-toolbar-group">
                {saveMode === "manual" ? (
                    <button
                        className="mxre-button mxre-button-primary"
                        disabled={!editable || saving || !dirty}
                        onClick={onSave}
                        title="Save the template (Ctrl+S)"
                        type="button"
                    >
                        <SaveIcon />
                        <span>{saving ? "Saving…" : "Save"}</span>
                    </button>
                ) : null}
                <button
                    className="mxre-button"
                    disabled={saving}
                    onClick={onReload}
                    title="Reload the template from the database, discarding unsaved changes"
                    type="button"
                >
                    <RefreshIcon />
                    <span>Reload</span>
                </button>
            </div>

            {isDesign ? (
                <div className="mxre-toolbar-group">
                    <button
                        className="mxre-button mxre-button-icon"
                        disabled={!editable || !canUndo}
                        onClick={onUndo}
                        title="Undo"
                        type="button"
                    >
                        <UndoIcon />
                    </button>
                    <button
                        className="mxre-button mxre-button-icon"
                        disabled={!editable || !canRedo}
                        onClick={onRedo}
                        title="Redo"
                        type="button"
                    >
                        <RedoIcon />
                    </button>
                    <VariableMenu
                        disabled={!editable}
                        onInsert={onInsertVariable}
                        prefix={variablePrefix}
                        suffix={variableSuffix}
                        variables={variables}
                    />
                </div>
            ) : null}

            {isPreview ? (
                <div className="mxre-toolbar-group">
                    <ToggleGroup label="Preview width">
                        <button
                            aria-pressed={previewWidth === "desktop"}
                            className={classNames("mxre-toggle", {
                                "mxre-toggle-active": previewWidth === "desktop"
                            })}
                            onClick={() => onPreviewWidthChange("desktop")}
                            title="Desktop width"
                            type="button"
                        >
                            <DesktopIcon />
                        </button>
                        <button
                            aria-pressed={previewWidth === "mobile"}
                            className={classNames("mxre-toggle", {
                                "mxre-toggle-active": previewWidth === "mobile"
                            })}
                            onClick={() => onPreviewWidthChange("mobile")}
                            title="Mobile width"
                            type="button"
                        >
                            <MobileIcon />
                        </button>
                    </ToggleGroup>
                </div>
            ) : null}

            {isCode ? (
                <div className="mxre-toolbar-group">
                    <button className="mxre-button" onClick={onCopy} type="button">
                        <CopyIcon />
                        <span>{copied ? "Copied" : "Copy"}</span>
                    </button>
                </div>
            ) : null}

            <div className="mxre-toolbar-spacer" />

            {showViewSwitcher ? (
                <ToggleGroup label="View">
                    {VIEWS.map(entry => (
                        <button
                            aria-pressed={view === entry.key}
                            className={classNames("mxre-toggle", {
                                "mxre-toggle-active": view === entry.key
                            })}
                            key={entry.key}
                            onClick={() => onViewChange(entry.key)}
                            type="button"
                        >
                            {entry.label}
                        </button>
                    ))}
                </ToggleGroup>
            ) : null}

            {showInspector && isDesign ? (
                <button
                    aria-pressed={inspectorOpen}
                    className={classNames("mxre-button mxre-button-icon", {
                        "mxre-toggle-active": inspectorOpen
                    })}
                    onClick={onToggleInspector}
                    title={inspectorOpen ? "Hide the style panel" : "Show the style panel"}
                    type="button"
                >
                    <PanelIcon />
                </button>
            ) : null}
        </div>
    );
}
