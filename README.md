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
- **Merge variables** — an optional list of tokens such as `{%FirstName%}` that
  the user can insert from the toolbar, filled in with sample values in Preview.
  Works directly with Model Reflection tokens for the Email Connector.
- **Send test** — an optional toolbar button that writes the template and runs
  your action, for example a popup that sends it with the Email Connector.
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

Point **Variables** at a list of objects. Each one becomes an entry in the
toolbar's Variable menu and is inserted at the cursor as literal text, which
survives the round-trip through your mail server untouched.

- **Full token** (optional): an attribute holding the complete token, delimiters
  included, inserted exactly as stored. For the Email Connector, bind it to
  Model Reflection's `Token.CombinedToken` (for example `{%FirstName%}`);
  `CreateEmailFromTemplate` then fills the tokens in when it sends.
- **Variable name**: used when there is no full token. The token is the name
  wrapped in **Prefix** and **Suffix**, `{%` and `%}` by default, which matches
  the Email Connector.
- **Variable label** and **Sample value** (optional): the label shown in the
  menu, and a value used to fill the token in the Preview. The saved template
  always keeps the tokens.

### Send test

Set **Send test action** and a Send test button appears in the toolbar. It
writes the current template to the attributes, without running **On save**, and
then runs the action. Typically that opens a popup that asks for a recipient and
sends the email with the Email Connector. **Send test caption** sets its label.

### Images

- **Ask for a URL** (default) prompts for the address of an image you already
  host. Only absolute `https://` addresses are accepted.
- **Embed as data URL** needs no back end, but the image is stored in every
  template and many email clients refuse to render data URLs. Fine for
  prototyping; Studio Pro warns when it is selected.
- **Upload via microflow** is the production option. The widget writes the
  base64 file into an attribute, optionally the file name into another, then
  runs your action and waits for a third attribute to be filled with the public
  URL of the stored image. By default it reports an error as soon as the action
  finishes without setting the URL, so the action must set it before it ends.
  If the action opens a page (for alt text, cropping or picking from a library)
  and the URL is set from there, turn on **Upload action opens a page**: the
  widget then waits until the timeout.

**Maximum image size** (2048 KB by default, 0 for no limit) refuses larger
files. Only PNG, JPEG, GIF and WebP are accepted, for data URLs and microflow
uploads: SVG can carry script, and Gmail and Outlook do not show it.

> **Validate uploads in your microflow.** The base64 data and the file name come
> from the user's browser and can be anything. Before storing, check the decoded
> file's real type (not the name's extension) and size, and sanitise or replace
> the file name.

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

#### Dark mode

React Email renders every style inline, and its emails carry no dark colours.
Add a `dark` object to the custom theme to give them some:

```json
{
  "extends": "basic",
  "styles": { "body": { "backgroundColor": "#f4f5f6" } },
  "dark": {
    "body": { "backgroundColor": "#1b5169", "color": "#f3f4f5" },
    "container": { "backgroundColor": "#2e3135" },
    "paragraph": { "color": "#e9eef0" },
    "button": { "backgroundColor": "#0089ab", "color": "#ffffff" }
  }
}
```

Parts: `body`, `container`, `surface` (panels inside the container), `h1`–`h3`,
`paragraph`, `link`, `button`, `divider`, `code` (code blocks and inline code;
without it they keep their light colours, so syntax highlighting stays
readable; with a `code.color`, every token takes that one colour, because the
highlighting colours are made for a light block); properties: `backgroundColor`,
`color`, `borderColor`. On save the widget tags the rendered elements by role
and adds `color-scheme` meta tags and `prefers-color-scheme: dark` rules (plus
Outlook's `[data-ogsc]`/`[data-ogsb]` variants), so Apple Mail, Outlook for Mac
and Outlook.com show the designed dark version. Gmail and Outlook for Windows
recolour emails themselves and ignore it.

The Preview's sun/moon switch shows the dark version, or, without dark colours,
a simulation of the apps that invert colours, so an invisible logo or a
low-contrast button shows up before sending.

The user can also change these from the style inspector, in which case the
change is stored in the template document, not in this setting.

## Notes and limits

- The widget is web-only; the editor depends on the DOM.
- The bundle is large: about 3.2 MB of minified JavaScript, a 2 MB `.mpk`.
  React Email renders the email in the browser, and the widget carries both the
  development and production builds of `react-dom/server` so it works on a
  locally run app and a deployed one. Expect a noticeable first load on a cold
  cache.
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

**This widget is built for Mendix 11 (React 19.2.3).** Five things have to agree
with the Studio Pro you target, and most of them fail only at app build or page
load, not while building the widget:

| | Mendix 10.24 | Mendix 11 (current) |
| --- | --- | --- |
| `@mendix/pluggable-widgets-tools` | `10.24.0` | `11.12.x` |
| React (`overrides` / `resolutions`) | `18.2.0` | `19.2.3` |
| `rollup` (`overrides`) | `3.30.0`, pinned | not needed, tools use 4 |
| JSX runtime | classic, `pragma: createElement` | automatic |
| `import { createElement } from "react"` in every `.jsx` | required | not needed |

The React version is the one that bites hardest. The Mendix client supplies
`react` and `react-dom` to the widget at runtime, but **not**
`react-dom/server`, so React Email's HTML renderer is bundled into the widget,
and it reads internals off the host's React. Those internals are renamed between
majors. A React 18 build on a React 19 client loads the page and dies with
`Cannot read properties of undefined (reading 'ReactCurrentDispatcher')`; the
reverse fails with `(reading 'd')`. Mendix reports either as "the page includes
a broken widget".

The build *mode* has to match too. A locally run app uses **development** React,
which calls `dispatcher.getOwner()` on the dispatcher the server renderer
installs, and only the development renderer provides it. A production-only
widget on a local app fails every save and preview with
`dispatcher.getOwner is not a function`. So `rollup.config.mjs` bundles both
builds of `react-dom/server` and picks the one that matches the host React at
runtime.

Two smaller traps, both handled in the config:

- `react` and `react-dom` must not appear in `dependencies` or
  `devDependencies`. The toolchain marks them `"remove"` and prompts to migrate
  if it finds them; in a non-interactive shell that prompt reads EOF and the
  build **exits 0 having built nothing**. Pin them through `overrides` /
  `resolutions` instead.
- On Mendix 10.24, `rollup` must be pinned to 3: every `@rollup/plugin-*`
  peer-requires rollup 4, which then wins the `node_modules/.bin/rollup` link
  and rejects the v3-shaped config with `Unknown input options: acorn, …`.

## Future work

From a feature-gap analysis for the Marketplace release. There is no
drag-and-drop email builder on the Marketplace; the Email Connector edits
templates with the generic Rich Text widget. So the widget is worth publishing
as it is, and the items below are about becoming the default choice, not about
more formatting options.

### Before or with the Marketplace release

- **Docs:** compare the widget with the Email Connector's Rich Text template
  screen, and ship a sample microflow that writes the output into
  `Email_Connector.EmailTemplate` (`Content`, `PlainBody`, `Subject`).
- **Version support:** state clearly that this build is Mendix 11.12 / React 19
  only, or add a Mendix 10.24 LTS build: the Email Connector targets 10.24.11 and
  many of its users are still on 10 LTS.
- **Third-party notices:** keep `dependencies.txt` (MIT notices for
  `@react-email/editor` and Tiptap) in the `.mpk`. The current build includes it.
- **Repository:** make it public, so the Studio Pro problem links resolve.

### 1.1: quick wins

- **Preheader** (inbox preview text) attribute, written as React Email's hidden
  `Preview` block.
- **Merge-tag fallbacks** such as `{%FirstName | there%}`, and a warning for
  tokens that are not in the variables datasource. The Email Connector cannot
  evaluate fallbacks, so either validate only or resolve them in a helper
  microflow.
- **Table block** for order summaries and key-value details.
- **Pre-send checks:** missing alt text, empty links, buttons without a URL,
  unresolved tokens, and an HTML size warning (Gmail clips messages over 102 KB;
  base64 images add a third to their size).
- **Link options:** a UTM appender, and `{%token%}` in link URLs.
- **Starter templates** (welcome, password reset, order confirmation,
  notification) and a "Start from template" picker.
- **Social icons and video-thumbnail blocks.**

### 1.2: differentiators

- **Repeat-for-each and display conditions:** a section setting such as "Repeat
  for association X" or "Show if attribute Y" that emits markers, and a Java
  action or microflow that expands them before `CreateEmailFromTemplate`. Email
  Connector tokens only go one level deep and cannot loop. Until then,
  document the HTML-valued token pattern: a microflow builds the rows and one
  token injects them.
- **Images as System.Image / FileDocument:** an "Inline (CID attachment)" mode
  using the Email Connector's `cid:mxcid:` inline attachments, and a picker
  over a datasource of image objects. Gmail strips `data:` images.
- **Email Connector bridge:** a companion module or documented snippet that
  copies HTML, text and subject into the Connector's template, carries over
  attachments, and feeds Model Reflection tokens (including one-level
  associations) into the variables datasource.

### 2.0

- **Reusable or synced partials** (header, footer, signature, legal text): a
  `Partial` entity and a block that stores only a reference; plus "Save
  selection as block".
- **Role-based locking** of blocks and sections, with a "Can edit locked
  content" expression.
- **Multilingual templates:** a `TemplateTranslation` entity and a language
  switcher in the toolbar.

### Longer term

- **Version history** as a `TemplateVersion` entity written by On save, with a
  Versions drawer. Tiptap's own version history needs its paid cloud server.
- **Review and approval** through a Mendix workflow (Draft, In review,
  Published) rather than in-editor comments.
- **Brand kit:** lock palette, fonts and button styles to the app's brand.
- **Custom web fonts** with email-safe fallbacks.
- **AI assist** (rewrite, shorten, translate, subject suggestions) as a
  bubble-menu button that calls a Mendix action.
- **ZIP export** (HTML and images). MJML export and rendering previews
  (Litmus, Email on Acid) are low value for internal Mendix apps.
- **Not planned:** AMP for email, and real-time co-editing. The concurrent-edit
  banner covers the Mendix case.

## Development

1. `npm install` (Node 22.18 or newer, below 23: what pluggable-widgets-tools 11.12 requires)
2. `npm start` rebuilds on every change into the `dist`, `deployment` and
   `widgets` folders of the Mendix project above.
3. `npm run lint` / `npm run lint:fix`
4. `npm test` runs the unit tests. It uses Babel rather than the toolchain's
   `test:unit:web`, whose SWC addon refuses to load on Windows machines where
   `C:\` lets other users replace files.
5. `npm run release` lints and produces
   `dist/<version>/stoneworx.ReactEmail.mpk`. Copy it into the app's `widgets`
   folder and press F4 in Studio Pro.

`prettier.config.js` and `.eslintrc.js` must stay CommonJS, which is why this
package is not `"type": "module"`; the Rollup config lives in
`rollup.config.mjs` instead.
