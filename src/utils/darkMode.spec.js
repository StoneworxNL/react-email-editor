import { applyDarkMode, darkPreviewHtml, darkRules, readDarkColours } from "./darkMode";

// A trimmed version of what React Email renders: inline styles, no classes.
const EMAIL = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" lang="en"><head><meta content="width=device-width" name="viewport"/></head>
<body style="background-color:#f4f5f6">
<table><tbody><tr><td style="font-family:Arial;background-color:#f4f5f6;color:#2e3135">
<table style="max-width:600px;width:100%;background-color:#ffffff"><tbody><tr><td style="padding:32px">
<h1 style="color:#2e3135">Your order</h1>
<p style="color:#2e3135">Hi Ada, <a href="https://example.com" style="color:#0089ab">track it</a></p>
<table style="background-color:#f6f9fc"><tbody><tr><td><p style="color:#2e3135">Summary</p></td></tr></tbody></table>
<ul><li style="color:#2e3135">One</li></ul>
<a href="https://example.com/contact" style="background-color:#0089ab;color:#ffffff;display:inline-block">Contact us</a>
<hr style="border-top:1px solid #eaeaea"/>
<h4 style="color:#8a8a8a">Kicker</h4>
<td style="color:#2e3135">Column text</td><span style="color:#5a5c61">Footer</span>
</td></tr></tbody></table>
</td></tr></tbody></table>
</body></html>`;

const DARK = {
    body: { backgroundColor: "#1b5169", color: "#f3f4f5" },
    container: { backgroundColor: "#2e3135" },
    surface: { backgroundColor: "#21637d" },
    h1: { color: "#ffffff" },
    paragraph: { color: "#e9eef0" },
    link: { color: "#cdeff8" },
    button: { backgroundColor: "#0089ab", color: "#ffffff" }
};

function parse(html) {
    return new DOMParser().parseFromString(html, "text/html");
}

describe("readDarkColours", () => {
    it("accepts known parts and colour properties", () => {
        expect(readDarkColours(DARK)).toEqual({ dark: DARK, error: null });
    });

    it("is empty without dark colours", () => {
        expect(readDarkColours(undefined)).toEqual({ dark: null, error: null });
        expect(readDarkColours({})).toEqual({ dark: null, error: null });
    });

    it.each([
        [{ footer: { color: "#fff" } }, /unknown part "footer"/],
        [{ h1: { fontSize: "20px" } }, /"h1.fontSize" is not supported/],
        [{ body: { color: "red;}body{display:none" } }, /"body.color" is not a colour/],
        [{ body: "dark" }, /"body" must be an object/],
        [[], /must be a JSON object/]
    ])("rejects %j", (config, message) => {
        const { dark, error } = readDarkColours(config);
        expect(dark).toBeNull();
        expect(error).toMatch(message);
    });
});

describe("darkRules", () => {
    it("overrides the inline colours and covers Outlook's dark mode attributes", () => {
        const rules = darkRules({ button: { backgroundColor: "#0089ab", color: "#fff" } }).join("\n");
        expect(rules).toContain(".rem-dark-button{background-color:#0089ab !important;color:#fff !important}");
        expect(rules).toContain("[data-ogsc] .rem-dark-button{color:#fff !important}");
        expect(rules).toContain("[data-ogsb] .rem-dark-button{background-color:#0089ab !important}");
    });
});

describe("applyDarkMode", () => {
    it("leaves the email alone without dark colours", () => {
        expect(applyDarkMode(EMAIL, null)).toBe(EMAIL);
        expect(applyDarkMode("", DARK)).toBe("");
    });

    it("marks each element with its role", () => {
        const doc = parse(applyDarkMode(EMAIL, DARK));
        const roleOf = selector => [...doc.querySelector(selector).classList].join(" ");
        expect(roleOf("body")).toBe("rem-dark-body");
        expect(roleOf("td[style*='font-family']")).toBe("rem-dark-body");
        expect(roleOf("table[style*='max-width']")).toBe("rem-dark-container");
        expect(roleOf("table[style*='#f6f9fc']")).toBe("rem-dark-surface");
        expect(roleOf("h1")).toBe("rem-dark-h1");
        expect(roleOf("li")).toBe("rem-dark-paragraph");
        expect(roleOf("p a")).toBe("rem-dark-link");
        expect(roleOf("a[style*='background-color']")).toBe("rem-dark-button");
        expect(roleOf("hr")).toBe("rem-dark-divider");
        expect(roleOf("h4")).toBe("rem-dark-h3");
        // Other text with its own light colour would be dark on dark otherwise.
        expect(roleOf("span[style*='#5a5c61']")).toBe("rem-dark-paragraph");
    });

    it("tells mail apps the email supports dark mode and adds the dark rules under the media query", () => {
        const html = applyDarkMode(EMAIL, DARK);
        const doc = parse(html);
        expect(doc.querySelector('meta[name="color-scheme"]').content).toBe("light dark");
        expect(doc.querySelector('meta[name="supported-color-schemes"]').content).toBe("light dark");
        const css = doc.querySelector("head style").textContent;
        expect(css).toContain("@media (prefers-color-scheme: dark){");
        expect(css).toContain(".rem-dark-body{background-color:#1b5169 !important;color:#f3f4f5 !important}");
    });

    it("keeps the doctype, the inline light styles and the content", () => {
        const html = applyDarkMode(EMAIL, DARK);
        expect(html.startsWith('<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN"')).toBe(true);
        expect(html).toContain('width:100%;background-color:#ffffff"');
        expect(html).toContain("Contact us");
    });
});

describe("code in dark mode", () => {
    // React Email writes code backgrounds with the `background` shorthand and
    // colours each syntax token with its own inline colour.
    const WITH_CODE = `<!DOCTYPE html><html><head></head><body style="background-color:#f4f5f6">
<table style="max-width:600px;background-color:#ffffff"><tbody><tr><td>
<p style="color:#2e3135">Run <code style="background:#e5e7eb;color:#1e293b">npm test</code> first.</p>
<pre style="background:#f1f5f9;padding:12px"><code style="font-family:monospace"><span style="color:#d73a49">const</span> <span style="color:#005cc5">x</span> = 1;</code></pre>
<div style="background:#f6f9fc"><p style="color:#2e3135">Panel</p></div>
</td></tr></tbody></table></body></html>`;

    it("keeps syntax colours and the block's own background unless code colours are set", () => {
        const doc = parse(applyDarkMode(WITH_CODE, DARK));
        expect([...doc.querySelector("pre").classList]).toEqual(["rem-dark-code"]);
        expect([...doc.querySelector("p code").classList]).toEqual(["rem-dark-code"]);
        // Token spans are left alone: recolouring them light on the light block made them unreadable.
        expect(doc.querySelectorAll("pre span[class]")).toHaveLength(0);
        expect(doc.querySelector("head style").textContent).not.toContain(".rem-dark-code");
    });

    it("applies code colours when the theme sets them", () => {
        const css = parse(
            applyDarkMode(WITH_CODE, { ...DARK, code: { backgroundColor: "#1b5169", color: "#f3f4f5" } })
        ).querySelector("head style").textContent;
        expect(css).toContain(".rem-dark-code{background-color:#1b5169 !important;color:#f3f4f5 !important}");
    });

    it("recognises panels whose background is written as the shorthand", () => {
        const doc = parse(applyDarkMode(WITH_CODE, DARK));
        expect([...doc.querySelector("div[style*='#f6f9fc']").classList]).toEqual(["rem-dark-surface"]);
    });
});

describe("darkPreviewHtml", () => {
    it("forces the designed dark colours on, whatever the viewer's own setting", () => {
        const css = parse(darkPreviewHtml(EMAIL, DARK)).querySelector('style[data-preview="dark"]').textContent;
        expect(css).toContain(".rem-dark-container{background-color:#2e3135 !important}");
        expect(css).not.toContain("@media");
    });

    it("simulates apps that invert colours when there are no dark colours", () => {
        const css = parse(darkPreviewHtml(EMAIL, null)).querySelector('style[data-preview="dark"]').textContent;
        expect(css).toContain("invert(1)");
        // Images are inverted back, as those apps leave pictures alone.
        expect(css).toMatch(/img[^{]*\{filter:invert\(1\)/);
    });

    it("passes empty input through", () => {
        expect(darkPreviewHtml("", DARK)).toBe("");
    });
});
