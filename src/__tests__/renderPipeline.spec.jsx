// The save path end to end, without mocks: a real <EmailEditor> renders a
// document through React Email (@react-email/render, html-to-text), then the
// widget's own post-processing runs on the result, exactly as on save.
//
// The widget relies on details of React Email's markup: the column cells'
// data-id (stacking on phones), the max-width container table (phone width),
// inline colours (dark mode) and tokens left as typed (variables). Fixtures in
// the other tests can't notice when an upgrade changes those; this test can.
import * as timers from "timers";
import * as webStreams from "stream/web";
import { act, render, waitFor } from "@testing-library/react";
import { EmailEditor } from "@react-email/editor";
import { applyDarkMode } from "../utils/darkMode";
import { applyMobileLayout } from "../utils/mobileLayout";
import { resolveTheme } from "../utils/theme";

// Under Jest's jsdom, @react-email/render loads its Node build, which needs web
// streams and react-dom/server's setImmediate. Node has them; jsdom's globals
// leave them out.
for (const [name, value] of [
    ["ReadableStream", webStreams.ReadableStream],
    ["WritableStream", webStreams.WritableStream],
    ["TransformStream", webStreams.TransformStream],
    ["setImmediate", timers.setImmediate],
    ["clearImmediate", timers.clearImmediate]
]) {
    if (typeof window[name] === "undefined") {
        window[name] = value;
    }
}

const text = value => ({ type: "text", text: value });
const paragraph = (...content) => ({ type: "paragraph", content });

const DOCUMENT = {
    type: "doc",
    content: [
        {
            type: "container",
            content: [
                { type: "heading", attrs: { level: 1 }, content: [text("Your order")] },
                paragraph(text("Hello {%FirstName%}, thank you for your order.")),
                paragraph(text("You can "), {
                    type: "text",
                    text: "track it",
                    marks: [{ type: "link", attrs: { href: "https://example.com/track" } }]
                }),
                {
                    type: "twoColumns",
                    content: [
                        { type: "columnsColumn", content: [paragraph(text("Left column"))] },
                        {
                            type: "columnsColumn",
                            content: [{ type: "image", attrs: { src: "https://example.com/logo.png", alt: "Logo" } }]
                        }
                    ]
                },
                { type: "button", attrs: { href: "https://example.com/order" }, content: [text("View order")] },
                { type: "codeBlock", attrs: { language: "javascript" }, content: [text("const total = 42;")] }
            ]
        }
    ]
};

const THEME_CONFIG = JSON.stringify({
    styles: { button: { backgroundColor: "#007693", color: "#ffffff" } },
    dark: {
        body: { backgroundColor: "#111111", color: "#eeeeee" },
        // A paragraph colour and no link colour, as in the README's example.
        paragraph: { color: "#dddddd" },
        container: { backgroundColor: "#1c1c1c" },
        button: { backgroundColor: "#4fc3e0", color: "#000000" }
    }
});

/** Render DOCUMENT with the editor and post-process it the way the widget saves it. */
async function renderAsSaved() {
    const { theme, dark, error } = resolveTheme("custom", THEME_CONFIG);
    expect(error).toBeNull();
    let ref = null;
    // onUploadImage is what turns on image blocks, as in the widget.
    render(
        <EmailEditor
            content={DOCUMENT}
            onReady={ready => (ref = ready)}
            onUploadImage={() => Promise.resolve({ url: "https://example.com/uploaded.png" })}
            theme={theme}
        />
    );
    await waitFor(() => expect(ref?.editor).toBeTruthy());
    let email;
    await act(async () => {
        email = await ref.getEmail();
    });
    const html = applyDarkMode(applyMobileLayout(email.html), dark);
    return { html, text: email.text, doc: new DOMParser().parseFromString(html, "text/html") };
}

/** Whether a declaration list sets a property (not one whose name merely ends in it). */
function setsProperty(style, property) {
    return style
        .split(";")
        .map(declaration => declaration.split(":")[0].trim())
        .includes(property);
}

/** React Email puts zero-width characters between code tokens and uses no-break spaces. */
function plain(value) {
    return value.replace(/[\u200b-\u200d\ufeff]/g, "").replace(/\u00a0/g, " ");
}

describe("rendering an email the way the widget saves it", () => {
    let saved;
    beforeAll(async () => {
        saved = await renderAsSaved();
    }, 60000);

    it("marks each column cell, so columns stack on phones", () => {
        const cells = [...saved.doc.querySelectorAll('td[data-id="__react-email-column"]')];
        const left = cells.find(cell => cell.textContent.includes("Left column"));
        const right = cells.find(cell => cell.querySelector('img[src="https://example.com/logo.png"]'));
        expect(left).toBeDefined();
        expect(right).toBeDefined();
        expect(left).not.toBe(right);
        expect(saved.html).toContain("data-mobile-layout");
    });

    it("renders the container as a max-width table, which the phone layout makes full width", () => {
        const containers = [...saved.doc.querySelectorAll("table")].filter(table =>
            (table.getAttribute("style") ?? "").includes("max-width")
        );
        expect(containers.length).toBeGreaterThan(0);
    });

    it("adds exactly one color-scheme meta tag when dark colours are set", () => {
        expect(saved.doc.querySelectorAll('meta[name="color-scheme"]')).toHaveLength(1);
        expect(saved.doc.querySelectorAll('meta[name="supported-color-schemes"]')).toHaveLength(1);
    });

    it("gives the button dark colours that beat every inline colour it has", () => {
        const button = saved.doc.querySelector('a[href="https://example.com/order"]');
        expect(button).not.toBeNull();
        expect(button.classList.contains("rem-dark-button")).toBe(true);
        const style = button.getAttribute("style") ?? "";
        // An inline !important would win over the dark rules.
        expect(style).not.toContain("!important");
        const css = [...saved.doc.querySelectorAll("head style")].map(element => element.textContent).join("");
        expect(css).toContain(".rem-dark-button{background-color:#4fc3e0 !important;color:#000000 !important}");
        // Every colour property set inline needs a dark rule, or WebKit keeps the
        // light colour (React Email sets -webkit-text-fill-color for Apple Mail).
        const inline = ["background-color", "color", "-webkit-text-fill-color"].filter(property =>
            setsProperty(style, property)
        );
        expect(inline).toContain("color");
        const darkRules = css.match(/\.rem-dark-button\{[^}]*\}/g) ?? [];
        for (const property of inline) {
            expect(darkRules.some(rule => setsProperty(rule.slice(rule.indexOf("{") + 1, -1), property))).toBe(true);
        }
    });

    it("keeps a link's own colour inside a dark paragraph in WebKit", () => {
        // -webkit-text-fill-color is inherited and paints over color, so a fill on
        // the paragraph (or anything around the link) would recolour the link.
        const link = saved.doc.querySelector('a[href="https://example.com/track"]');
        expect(link).not.toBeNull();
        const css = [...saved.doc.querySelectorAll("head style")].map(element => element.textContent).join("");
        const filled = new Set(
            [...css.matchAll(/.rem-dark-([a-z0-9-]+){[^}]*-webkit-text-fill-color/g)].map(match => match[1])
        );
        expect(filled.has("paragraph")).toBe(false);
        for (let element = link; element; element = element.parentElement) {
            const parts = [...element.classList]
                .filter(name => name.startsWith("rem-dark-"))
                .map(name => name.slice(9));
            expect(parts.filter(part => filled.has(part))).toEqual([]);
        }
    });

    it("leaves variables as typed in the HTML and the plain text", () => {
        expect(saved.html).toContain("{%FirstName%}");
        expect(saved.text).toContain("{%FirstName%}");
    });

    it("writes readable plain text: heading, button link and code", () => {
        expect(saved.text).toMatch(/YOUR ORDER|Your order/);
        expect(saved.text).toContain("https://example.com/order");
        expect(plain(saved.text)).toContain("const total = 42;");
    });
});
