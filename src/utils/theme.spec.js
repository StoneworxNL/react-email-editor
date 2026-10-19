import { resolveTheme } from "./theme";

describe("resolveTheme", () => {
    it.each(["basic", "minimal"])("passes the %s preset through", preset => {
        expect(resolveTheme(preset, "")).toEqual({ theme: preset, dark: null, error: null });
    });

    it("falls back to basic for an unknown preset", () => {
        expect(resolveTheme("neon", "")).toEqual({ theme: "basic", dark: null, error: null });
    });

    it("uses basic without an error when custom has no configuration", () => {
        expect(resolveTheme("custom", "  ")).toEqual({ theme: "basic", dark: null, error: null });
    });

    it("builds a custom theme from styles", () => {
        const config = JSON.stringify({ extends: "minimal", styles: { button: { borderRadius: "13px" } } });
        expect(resolveTheme("custom", config)).toEqual({
            theme: { extends: "minimal", styles: { button: { borderRadius: "13px" } } },
            dark: null,
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

    it("reads dark colours next to the styles", () => {
        const config = JSON.stringify({
            styles: { body: { backgroundColor: "#f4f5f6" } },
            dark: { body: { backgroundColor: "#1b5169" } }
        });
        expect(resolveTheme("custom", config)).toEqual({
            theme: { extends: "basic", styles: { body: { backgroundColor: "#f4f5f6" } } },
            dark: { body: { backgroundColor: "#1b5169" } },
            error: null
        });
    });

    it("does not mistake the dark colours for a themeable part when styles are given inline", () => {
        const result = resolveTheme("custom", '{"body":{"color":"#000"},"dark":{"body":{"color":"#fff"}}}');
        expect(result.theme.styles).toEqual({ body: { color: "#000" } });
        expect(result.dark).toEqual({ body: { color: "#fff" } });
    });

    it("keeps the light theme when the dark colours are broken", () => {
        const result = resolveTheme("custom", '{"styles":{"body":{"color":"#000"}},"dark":{"footer":{}}}');
        expect(result.theme).toEqual({ extends: "basic", styles: { body: { color: "#000" } } });
        expect(result.dark).toBeNull();
        expect(result.error).toMatch(/Dark theme colours ignored/);
    });
});
