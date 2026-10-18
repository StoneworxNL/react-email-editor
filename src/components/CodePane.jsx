/** Read-only view of the composed HTML or the plain-text alternative. */

export function CodePane({ value, loading, emptyLabel }) {
    if (loading) {
        return <div className="mxre-placeholder">Rendering…</div>;
    }
    if (!value) {
        return <div className="mxre-placeholder">{emptyLabel}</div>;
    }
    return (
        <pre className="mxre-code">
            <code>{value}</code>
        </pre>
    );
}
