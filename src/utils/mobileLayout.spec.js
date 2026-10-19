import { MOBILE_BREAKPOINT, applyMobileLayout } from "./mobileLayout";

const WITH_COLUMNS = `<html><head><meta name="viewport" content="width=device-width"></head><body>
<table><tbody><tr>
<td data-id="__react-email-column">Logo</td><td data-id="__react-email-column">About · Contact us</td>
</tr></tbody></table></body></html>`;

describe("applyMobileLayout", () => {
    it("adds rules that stack column cells on small screens", () => {
        const html = applyMobileLayout(WITH_COLUMNS);
        const css = new DOMParser()
            .parseFromString(html, "text/html")
            .querySelector("style[data-mobile-layout]").textContent;
        expect(css).toContain(`@media only screen and (max-width: ${MOBILE_BREAKPOINT}px)`);
        expect(css).toContain('td[data-id="__react-email-column"]{display:block !important;width:100% !important');
        expect(css).toContain("img{max-width:100% !important");
    });

    it("puts the rules in the head and keeps the content", () => {
        const html = applyMobileLayout(WITH_COLUMNS);
        expect(html.indexOf("data-mobile-layout")).toBeLessThan(html.indexOf("</head>"));
        expect(html).toContain("About · Contact us");
    });

    it("adds them once", () => {
        const once = applyMobileLayout(WITH_COLUMNS);
        expect(applyMobileLayout(once)).toBe(once);
    });

    it("leaves emails without columns alone", () => {
        const plain = "<html><head></head><body><p>Hi</p></body></html>";
        expect(applyMobileLayout(plain)).toBe(plain);
        expect(applyMobileLayout("")).toBe("");
        expect(applyMobileLayout(undefined)).toBeUndefined();
    });
});
