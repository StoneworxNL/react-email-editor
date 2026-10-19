/**
 * Stack column layouts on phones.
 *
 * React Email renders 2/3/4-column blocks as table cells, which stay side by
 * side at any width: on a 390px phone a two-column header pushes the whole email
 * wider than the screen. Each column cell carries data-id="__react-email-column",
 * so a small-screen media query can turn the cells into full-width blocks. Mail
 * apps that support media queries in the email's style block (Apple Mail, iOS
 * Mail, the Gmail and Outlook apps) then show the columns one under the other.
 */

export const MOBILE_BREAKPOINT = 480;

const MOBILE_CSS =
    `@media only screen and (max-width: ${MOBILE_BREAKPOINT}px){` +
    'td[data-id="__react-email-column"]{display:block !important;width:100% !important;' +
    "box-sizing:border-box !important;padding-left:0 !important;padding-right:0 !important}" +
    "img{max-width:100% !important;height:auto !important}}";

/** Add the column-stacking rules to a rendered email. Idempotent. */
export function applyMobileLayout(html) {
    if (typeof html !== "string" || !html.includes('data-id="__react-email-column"')) {
        return html;
    }
    if (html.includes("data-mobile-layout")) {
        return html;
    }
    const style = `<style data-mobile-layout="">${MOBILE_CSS}</style>`;
    return /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${style}</head>`) : style + html;
}
