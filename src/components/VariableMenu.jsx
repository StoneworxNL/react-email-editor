import { ChevronDownIcon, VariableIcon } from "./Icons";
import { createElement, useEffect, useRef, useState } from "react";
import { buildToken } from "../utils/template";

/**
 * Drop-down that inserts a merge variable at the cursor.
 *
 * Deliberately plain: the value of the feature is the token, not the chrome,
 * and a custom Tiptap node would not survive the round-trip through a mail
 * server the way literal text does.
 */
export function VariableMenu({ variables, prefix, suffix, disabled, onInsert }) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        if (!open) {
            return undefined;
        }
        const onPointerDown = event => {
            if (!containerRef.current?.contains(event.target)) {
                setOpen(false);
            }
        };
        const onKeyDown = event => {
            if (event.key === "Escape") {
                setOpen(false);
            }
        };
        document.addEventListener("pointerdown", onPointerDown, true);
        document.addEventListener("keydown", onKeyDown, true);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown, true);
            document.removeEventListener("keydown", onKeyDown, true);
        };
    }, [open]);

    if (!variables.length) {
        return null;
    }

    return (
        <div className="mxre-menu" ref={containerRef}>
            <button
                aria-expanded={open}
                aria-haspopup="menu"
                className="mxre-button"
                disabled={disabled}
                onClick={() => setOpen(value => !value)}
                title="Insert a merge variable"
                type="button"
            >
                <VariableIcon />
                <span>Variable</span>
                <ChevronDownIcon size={14} />
            </button>
            {open ? (
                <div className="mxre-menu-list" role="menu">
                    {variables.map(variable => (
                        <button
                            className="mxre-menu-item"
                            key={variable.id}
                            onClick={() => {
                                setOpen(false);
                                onInsert(variable);
                            }}
                            role="menuitem"
                            type="button"
                        >
                            <span className="mxre-menu-item-label">{variable.label}</span>
                            <span className="mxre-menu-item-token">{buildToken(prefix, variable.name, suffix)}</span>
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
}
