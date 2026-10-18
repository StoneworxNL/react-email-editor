import { renderHook } from "@testing-library/react";
import { useLatest } from "./useLatest";

describe("useLatest", () => {
    it("keeps one ref that follows the latest value", () => {
        const { result, rerender } = renderHook(({ value }) => useLatest(value), { initialProps: { value: 1 } });
        const first = result.current;
        expect(first.current).toBe(1);

        rerender({ value: 2 });
        expect(result.current).toBe(first);
        expect(first.current).toBe(2);
    });
});
