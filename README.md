# Email Template Editor

A Mendix pluggable widget that loads, edits and saves email templates using the
[React Email 6 editor](https://resend.com/blog/react-email-6)
(`@react-email/editor`).

## Features

- **Block editing** — headings, lists, quotes, code blocks, buttons, dividers,
  sections and 2/3/4-column layouts, through a slash menu (`/`) and a selection
  bubble menu.
- **Style inspector** — a side panel that edits the styling of the selected
  block, and of the template as a whole (body background, container width,
  padding, colours).
- **Four views** — Design, Preview (in a sandboxed iframe, desktop or mobile
  width), the rendered HTML, and the plain-text alternative.
- **Merge variables** — an optional list of tokens such as `{{firstName}}` that
  the user can insert from the toolbar, filled in with sample values in Preview.
- **Manual or automatic saving**, plus <kbd>Ctrl</kbd>+<kbd>S</kbd>.
- **Concurrent-edit handling** — if the template changes elsewhere while the
  user has unsaved work, the widget offers the choice rather than silently
  overwriting either side.
- **Images** — embed as a data URL, ask for a URL, or hand the upload to a
  microflow.

## How the template is stored

Three different things come out of the editor, and it matters which one you
load from:

| Attribute | What it holds | Direction |
| --- | --- | --- |
| **Document** | the editor's own JSON document | read **and** written |
| **Email HTML** | the rendered, send-ready email HTML | written (read only as a fallback) |
| **Plain text** | the plain-text alternative | written |

The rendered HTML is a *product* of the document — full `<html>`, tables and
inline styles produced by React Email — not a representation the editor can
read back exactly. **Configure the Document attribute.** It is what makes
opening a saved template give you back precisely what you saved.

If you only configure Email HTML, the widget still works: it imports that HTML
into the editor on load. But the import goes through the editor's schema, so
styling and layout can drift a little on every open. Studio Pro shows a warning
when the Document attribute is missing.

Both should be **unlimited-length** string attributes; a rendered template is
easily tens of kilobytes.

## Usage

1. Put the widget inside a data view over your template entity.
2. Set **Document** to an unlimited-length string attribute. Set **Email HTML**
   to another one — that is the attribute you send with.
3. Optionally set **Plain text** and **Subject**.
4. Pick a **Save mode**. Manual gives the user a Save button; Automatic writes
   to the attributes after a short pause. Either way, **On save** runs after the
   write, which is where you commit the object.
5. Send the email using the value of the Email HTML attribute.

### Merge variables

Point **Variables** at a list of objects with a name attribute (`firstName`),
optionally a label (`First name`) and a sample value (`Ada`). The user inserts
them from the toolbar as literal text — `{{firstName}}` — which survives the
round-trip through your mail server untouched. Change the delimiters with
**Prefix** and **Suffix**. Sample values are used only to fill in the Preview;
the saved template always keeps the tokens.

### Images

- **Embed as data URL** (default) needs no back end, but many email clients
  refuse to render data URLs. Fine for prototyping.
- **Ask for a URL** prompts for the address of an image you already host.
- **Upload via microflow** is the production option. The widget writes the
  base64 file into an attribute, optionally the file name into another, then
  runs your action and waits for a third attribute to be filled with the public
  URL of the stored image. It gives up after the configured timeout.

### Theming

**Theme** picks the `basic` or `minimal` preset from React Email, or `custom`,
which takes JSON:

```json
{
  "extends": "basic",
  "styles": {
    "body": { "backgroundColor": "#f6f9fc" },
    "container": { "width": "600px" },
    "button": { "backgroundColor": "#2563eb", "borderRadius": "6px" }
  }
}
```

Themeable parts: `body`, `container`, `h1`, `h2`, `h3`, `paragraph`, `link`,
`image`, `button`, `codeBlock`, `inlineCode`. Invalid JSON or an unknown part
falls back to `basic` and says so in the widget rather than failing to render.

The user can also change these from the style inspector, in which case the
change is stored in the template document, not in this setting.

## Notes and limits

- The widget is web-only; the editor depends on the DOM.
- The bundle is large (~3 MB minified) because React Email renders the email in
  the browser. Expect a noticeable first load on a cold cache.
- Code blocks fall back to highlighting as JavaScript for languages Prism does
  not bundle. React Email lazy-loads those grammars with
  ``import(`prismjs/components/prism-${language}`)``, and a dynamic import whose
  specifier is computed cannot survive into a Mendix widget: Mendix's own
  bundler refuses the *whole app* with `invalid import "undefined"`. So
  `rollup.config.mjs` replaces that call with a rejected promise at build time,
  which is the case the editor already handles. A `renderChunk` guard in the
  same file fails the widget build if another one ever appears, rather than
  letting it surface later as an app-wide build error that does not name this
  widget.
- **Warn on unsaved changes** uses the browser's own "leave site?" dialog, which
  browsers only show after the user has interacted with the page.

## Mendix version compatibility

**This widget is built for Mendix 10.24 (React 18).** That is not a detail of
the build script; it reaches into the source. Five things have to agree with the
Studio Pro you target, and four of them fail loudly only at app build or page
load, not while building the widget:

| | Mendix 10.24 | Mendix 11 |
| --- | --- | --- |
| `@mendix/pluggable-widgets-tools` | `10.24.0` | `11.x` |
| React (`overrides` / `resolutions`) | `18.2.0` | `19.x` |
| `rollup` (`overrides`) | `3.30.0` — pinned | not needed, tools use 4 |
| JSX runtime | classic, `pragma: createElement` | automatic |
| `import { createElement } from "react"` in every `.jsx` | **required** | not needed |

The React version is the one that bites hardest. The Mendix client supplies
`react` and `react-dom` to the widget at runtime, but **not** `react-dom/server`
— so React Email's HTML renderer is bundled into the widget, and it reads
internals off the host's `react-dom`. Those internals are renamed between
majors. A React 19 build on a React 18 client loads the page and dies with:

```
TypeError: Cannot read properties of undefined (reading 'd')
```

which is `react-dom/server@19` asking React 18 for
`__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE`. Mendix reports
it as "the page includes a broken widget". Everything in the React Email stack
peer-accepts `^18 || ^19`, so either works — it just has to *match the client*.

To move this widget to Mendix 11: bump the toolchain to `11.x`, set React to
`19.x`, drop the `rollup` pin, and delete the `createElement` imports (Mendix 11
compiles JSX with the automatic runtime, and the lint config there rejects the
imports as unused).

Two smaller traps, both handled in the config, both worth knowing about:

- `react` and `react-dom` must not appear in `dependencies` or
  `devDependencies`. The toolchain marks them `"remove"` and prompts to migrate
  if it finds them; in a non-interactive shell that prompt reads EOF and the
  build **exits 0 having built nothing**. Pin them through `overrides` /
  `resolutions` instead.
- `rollup` must be pinned. Every `@rollup/plugin-*` that tools 10.24 depends on
  peer-requires rollup 4, npm installs and hoists it, and it wins the
  `node_modules/.bin/rollup` link — so the v3-shaped config reaches the v4
  binary and the build dies with `Unknown input options: acorn, …`.

## Development

1. `npm install`
2. `npm start` rebuilds on every change into the `dist`, `deployment` and
   `widgets` folders of the Mendix project above.
3. `npm run lint` / `npm run lint:fix`
4. `npm run release` produces `dist/<version>/stoneworx.ReactEmail.mpk`.

`prettier.config.js` and `.eslintrc.js` must stay CommonJS, which is why this
package is not `"type": "module"`; the Rollup config lives in
`rollup.config.mjs` instead.
