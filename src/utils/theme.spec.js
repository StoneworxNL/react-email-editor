import { resolveTheme } from "./theme";

describe("resolveTheme", () => {
    it.each(["basic", "minimal"])("passes the %s preset through", preset => {
        expect(resolveTheme(preset, "")).toEqual({ theme: preset, error: null });
    });

    it("falls back to basic for an unknown preset", () => {
        expect(resolveTheme("neon", "")).toEqual({ theme: "basic", error: null });
    });

    it("uses basic without an error when custom has no configuration", () => {
        expect(resolveTheme("custom", "  ")).toEqual({ theme: "basic", error: null });
    });

    it("builds a custom theme from styles", () => {
        const config = JSON.stringify({ extends: "minimal", styles: { button: { borderRadius: "13px" } } });
        expect(resolveTheme("custom", config)).toEqual({
            theme: { extends: "minimal", styles: { button: { borderRadius: "13px" } } },
            error: null
        });
    });

    it("accepts the styles object on its own and defaults to extending basic", () => {
        expect(resolveTheme("custom", '{"body":{"color":"#000"}}').theme).toEqual({
            extends: "basic",
            styles: { body: { color: "#000" } }
        });
    });

    it.each([
        ["invalid JSON", "{", /not valid JSON/],
        ["an array", "[]", /must be a JSON object/],
        ["unknown parts", '{"styles":{"footer":{}}}', /unknown parts: footer/],
        ["a styles array", '{"styles":[]}', /needs a "styles" object/]
    ])("reports %s and falls back to basic", (_label, config, message) => {
        const result = resolveTheme("custom", config);
        expect(result.theme).toBe("basic");
        expect(result.error).toMatch(message);
    });
});
