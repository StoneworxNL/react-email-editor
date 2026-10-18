/**
 * Design-time preview for Studio Pro.
 *
 * This deliberately does not mount the real editor: instantiating ProseMirror
 * and react-email inside the Studio Pro canvas is slow and buys nothing. What a
 * modeller needs to see is the shape of the widget and which parts are switched
 * on, so that is what this draws.
 */

const VIEWS = ["Design", "Preview", "HTML", "Text"];

function Chip({ children, active }) {
    return (
        <span
            style={{
                padding: "3px 10px",
                borderRadius: 6,
                fontSize: 12,
                color: active ? "#1c1c1c" : "#6b6b6b",
                background: active ? "#fff" : "transparent",
                boxShadow: active ? "0 1px 2px rgba(0,0,0,.08)" : "none"
            }}
        >
            {children}
        </span>
    );
}

function Line({ width, height = 10, color = "#e4e4e7" }) {
    return <div style={{ width, height, borderRadius: 3, background: color }} />;
}

export function preview({
    showToolbar,
    showViewSwitcher,
    showInspector,
    subjectAttribute,
    saveMode,
    onSendTestAction,
    sendTestCaption,
    heightMode,
    heightValue,
    class: className,
    style
}) {
    const height = heightMode === "fill" ? 420 : Math.max(240, heightValue || 640);

    return (
        <div
            className={className}
            style={{
                display: "flex",
                flexDirection: "column",
                height,
                overflow: "hidden",
                border: "1px solid #e5e5e5",
                borderRadius: 12,
                background: "#fff",
                color: "#1c1c1c",
                fontFamily: "system-ui, sans-serif",
                ...style
            }}
        >
            {showToolbar ? (
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 10px",
                        borderBottom: "1px solid #e5e5e5"
                    }}
                >
                    {saveMode !== "auto" ? (
                        <span
                            style={{
                                padding: "5px 12px",
                                borderRadius: 8,
                                background: "#18181b",
                                color: "#fff",
                                fontSize: 13
                            }}
                        >
                            Save
                        </span>
                    ) : null}
                    <span
                        style={{
                            padding: "5px 12px",
                            border: "1px solid #e5e5e5",
                            borderRadius: 8,
                            fontSize: 13
                        }}
                    >
                        Reload
                    </span>
                    <span style={{ flex: 1 }} />
                    {onSendTestAction ? (
                        <span
                            style={{
                                padding: "5px 12px",
                                border: "1px solid #e5e5e5",
                                borderRadius: 8,
                                fontSize: 13
                            }}
                        >
                            {typeof sendTestCaption === "string" && sendTestCaption ? sendTestCaption : "Send test"}
                        </span>
                    ) : null}
                    {showViewSwitcher ? (
                        <span
                            style={{
                                display: "inline-flex",
                                gap: 2,
                                padding: 2,
                                borderRadius: 8,
                                background: "#f4f4f5"
                            }}
                        >
                            {VIEWS.map((label, index) => (
                                <Chip active={index === 0} key={label}>
                                    {label}
                                </Chip>
                            ))}
                        </span>
                    ) : null}
                </div>
            ) : null}

            {subjectAttribute ? (
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 12px",
                        borderBottom: "1px solid #e5e5e5"
                    }}
                >
                    <span style={{ fontSize: 11, letterSpacing: ".04em", color: "#6b6b6b" }}>SUBJECT</span>
                    <Line width={220} />
                </div>
            ) : null}

            <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
                <div style={{ flex: 1, padding: 24, background: "#f4f4f5" }}>
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 12,
                            maxWidth: 520,
                            margin: "0 auto",
                            padding: 24,
                            borderRadius: 8,
                            background: "#fff"
                        }}
                    >
                        <Line height={18} width="55%" color="#d4d4d8" />
                        <Line width="100%" />
                        <Line width="92%" />
                        <Line width="76%" />
                        <div
                            style={{
                                width: 130,
                                height: 34,
                                marginTop: 8,
                                borderRadius: 6,
                                background: "#2563eb"
                            }}
                        />
                    </div>
                </div>
                {showInspector ? (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 10,
                            width: 200,
                            padding: 14,
                            borderLeft: "1px solid #e5e5e5"
                        }}
                    >
                        <Line width="60%" color="#d4d4d8" />
                        <Line width="100%" />
                        <Line width="100%" />
                        <Line width="80%" />
                    </div>
                ) : null}
            </div>

            <div
                style={{
                    padding: "6px 12px",
                    borderTop: "1px solid #e5e5e5",
                    color: "#6b6b6b",
                    fontSize: 12
                }}
            >
                {saveMode === "auto" ? "Saves automatically" : "No changes"}
            </div>
        </div>
    );
}

export function getPreviewCss() {
    return require("./ui/ReactEmail.css");
}
