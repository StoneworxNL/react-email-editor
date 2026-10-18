import { useLayoutEffect, useRef } from "react";

/**
 * A ref that always holds the latest committed value.
 *
 * For callbacks and effects that must read current props or state without
 * being recreated on every change. The ref is written in a layout effect, not
 * during render, so a render that React throws away never leaks into it, and
 * it is already up to date when ordinary effects and event handlers run.
 */
export function useLatest(value) {
    const ref = useRef(value);
    useLayoutEffect(() => {
        ref.current = value;
    });
    return ref;
}
