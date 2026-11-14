# Email Template Editor widget

Mendix pluggable widget (web) that wraps the [React Email 6](https://react.email) editor (`@react-email/editor`, built
on Tiptap). Published on the Mendix Marketplace by Stoneworx. The repo is private for now and goes public with the
Marketplace release, so treat everything in it, history included, as public.

## Before you start

Check open PRs and branches first (`gh api repos/StoneworxNL/react-email-editor/pulls`) and build on them; work is often
already in progress there. If a PR is open, put follow-up commits on its branch instead of opening a new one.

## Build and test

-   Node 22.18 or later, below 23 (what `@mendix/pluggable-widgets-tools` 11.12 requires). Install with `npm ci`.
-   `npm run lint` (run `npx prettier --write .` first if it complains about formatting), `npm test`, `npm run release`
    (lints again, then builds `dist/<version>/stoneworx.ReactEmail.mpk`).
-   `npm test` runs Jest with Babel (`jest.config.js`), not the toolchain's `test:unit:web`: its SWC native addon
    refuses to load on Windows machines where `C:\` lets other users replace files.
-   `npm start` / `npm run build` are development builds that copy the widget into the Mendix app at
    `config.projectPath` (`../../`). Ship only the `release` build.
-   The release `.mpk` must contain `LICENSE` and the generated `dependencies.txt` (license text of every bundled
    package). `postrelease` (`scripts/check-mpk.js`) checks both after every `npm run release`, on any OS. The tools'
    own LICENSE copy silently fails on Windows (backslash path in a glob), so `rollup.config.mjs` copies LICENSE itself
    (`copyLicenseIntoWidget`) and fails the build if it can't.

## Dependency quirks

-   Toolchain and React must match the target Studio Pro exactly: Mendix 11.12 React client = React 19.2.3, so
    `pluggable-widgets-tools` 11.12.x, with `react`/`react-dom` pinned through `resolutions` and `overrides` (never as
    dependencies; see `comment_react_version` in `package.json`). Dependabot ignores minor/major toolchain bumps; move
    the toolchain by hand together with the app.
-   `react-dom/server` is not provided by the Mendix client, so it is bundled. `rollup.config.mjs` bundles both the
    production and development builds and picks one at runtime from the host React.
-   `rollup.config.mjs` also converts `rem` to `px` in React Email's and the widget's CSS (Atlas sets the root font size
    to 10px, which shrank the editor UI to 62.5%), stubs React Email's computed Prism language import (Mendix's bundler
    rejects it), drops `@jsxImportSource` pragmas and swaps in a commonjs plugin that converts `require` of externals.
    Keep the Mendix plugins in the list: the license plugin lives there.
-   `prettier.config.js` and `.eslintrc.js` must stay CommonJS, so the package is not `"type": "module"`.

## Releasing

Bump the version in both `package.json` and `src/package.xml`, date the entry in `CHANGELOG.md`, tag `v<version>` and
attach the release `.mpk` to the GitHub release.

## Compliance

-   No secrets, credentials, internal URLs, customer data or personal emails in the repo (the `Compliance` workflow runs
    gitleaks on the full history). Don't name reviewers or colleagues in repo docs.
-   Commits: author and committer `João Lopes <jlopes@stoneworx.nl>`, no `Co-Authored-By` trailers. Never force-push or
    rewrite history.
-   Bundled (production) dependencies must be MIT, MIT-0, ISC, BSD-2/3-Clause, 0BSD, Apache-2.0, Python-2.0, CC0-1.0 or
    BlueOak-1.0.0 (the `Compliance` workflow checks this with `license-checker-rseidelsohn@4.4.2`; a dual license passes
    when one option is allowed). Anything else needs a decision before it is added.
-   The `Compliance` workflow pins gitleaks by version and SHA-256 (`GITLEAKS_VERSION`, `GITLEAKS_SHA256`, from the
    release's checksums file). Update both together.
-   The `Request review` workflow needs the `PR_REVIEWER` repository or organization variable (a GitHub login); without
    it the job is skipped. Never hard-code a login in the workflow.
-   A bundled package that ships no license file loses its notice in `dependencies.txt`. Add its upstream license to the
    "Third-party notices" section of `LICENSE` (currently `react-remove-scroll-bar`).
-   The widget is Apache-2.0 (`LICENSE`, `package.json` `license`).
