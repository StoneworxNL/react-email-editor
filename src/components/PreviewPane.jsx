import classNames from "classnames";

const MOBILE_WIDTH = 390;

/**
 * Renders the composed email in a sandboxed iframe, so the email's own styles
 * cannot leak into the Mendix page and the page's styles cannot flatter the
 * email into looking better than it is.
 */
export function PreviewPane({ html, width, loading, note }) {
    if (loading) {
        return <div className="mxre-placeholder">Rendering preview…</div>;
    }
    if (!html) {
        return <div className="mxre-placeholder">Nothing to preview yet.</div>;
    }
    return (
        <div className="mxre-preview">
            {note ? <p className="mxre-preview-note">{note}</p> : null}
            <iframe
                className={classNames("mxre-preview-frame", {
                    "mxre-preview-frame-mobile": width === "mobile"
                })}
                sandbox=""
                srcDoc={html}
                style={width === "mobile" ? { width: `${MOBILE_WIDTH}px` } : undefined}
                title="Email preview"
            />
        </div>
    );
}
