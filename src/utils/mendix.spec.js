import { action, attribute, listAttribute } from "../__tests__/mendixMocks";
import {
    allSettled,
    executeAction,
    isAvailable,
    isLoading,
    isWritable,
    readListAttribute,
    readString,
    writeString
} from "./mendix";

describe("value helpers", () => {
    it("tolerate undefined values", () => {
        expect(isAvailable(undefined)).toBe(false);
        expect(isLoading(undefined)).toBe(false);
        expect(isWritable(undefined)).toBe(false);
        expect(readString(undefined)).toBe("");
        expect(writeString(undefined, "x")).toBe(false);
    });

    it("read strings, treating empty values as empty", () => {
        expect(readString(attribute("hello"))).toBe("hello");
        expect(readString(attribute(undefined))).toBe("");
        expect(readString(attribute("x", { status: "loading" }))).toBe("");
    });

    it("write only when allowed and changed", () => {
        const attr = attribute("same");
        expect(writeString(attr, "same")).toBe(false);
        expect(writeString(attr, "new")).toBe(true);
        expect(attr.setValue).toHaveBeenCalledWith("new");

        const readOnly = attribute("a", { readOnly: true });
        expect(writeString(readOnly, "b")).toBe(false);
        expect(readOnly.setValue).not.toHaveBeenCalled();
    });

    it("run actions only when they can run and are idle", () => {
        const ok = action();
        expect(executeAction(ok)).toBe(true);
        expect(ok.execute).toHaveBeenCalledTimes(1);

        expect(executeAction(action({ canExecute: false }))).toBe(false);
        expect(executeAction(action({ isExecuting: true }))).toBe(false);
        expect(executeAction(undefined)).toBe(false);
    });

    it("know when everything has settled", () => {
        expect(allSettled([attribute("a"), undefined])).toBe(true);
        expect(allSettled([attribute("a", { status: "loading" })])).toBe(false);
    });

    it("read list attributes as strings", () => {
        const list = listAttribute({ a: 42 });
        expect(readListAttribute(list, { id: "a" })).toBe("42");
        expect(readListAttribute(list, { id: "b" })).toBeUndefined();
        expect(readListAttribute(undefined, { id: "a" })).toBeUndefined();
    });
});
