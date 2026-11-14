# Changelog

All notable changes to the Email Template Editor widget.

## [1.0.0] - 2026-11-14

### Added
- Mendix 11 support (React 19.2.3, pluggable-widgets-tools 11.12).
- Full token property for Model Reflection `CombinedToken`s; `{%` and `%}` as
  default delimiters for the Email Connector.
- Send test action and toolbar button.
- Dark mode colours in the custom theme, written into the email on save, and a
  light/dark switch in the Preview.
- Column layouts stack on phones in the sent email and the preview.
- Readable names in the style panel's path, and an outline on the selected block.
- Maximum image size property; PNG, JPEG, GIF and WebP only (no SVG); https-only
  URLs in Ask for a URL; Ask for a URL is the default image mode.
- Upload action opens a page option, for uploads that finish from a page, with
  a Studio Pro warning for a timeout under 120 seconds.
- Studio Pro toolbox icon and tile, light and dark.
- Unit tests (`npm test`) and a CI workflow (lint, test, build).

### Changed
- Updated @react-email/editor 1.7.7 to 1.8.4 (react-email 6.9.5 to 6.11.11) and
  Tiptap 3.32.0 to 3.33.1. Upstream fixes: placeholders on empty headings, slash
  command menu clicks and crashes, code block highlighting for language aliases,
  and buttons stay readable in Apple Mail dark mode. The .mpk is about 18% smaller.
  Dark-mode button labels keep their dark colour in Apple Mail, where React Email
  now sets an inline `-webkit-text-fill-color`.
  Still needs Mendix 11.12 or later; building needs Node 22.18 or later (below 23).

### Fixed
- Edits typed while a save was rendering are no longer marked as saved.
- Automatic save no longer overwrites a version changed elsewhere while the
  banner asks the user to choose, including a save already rendering; Keep my
  changes then saves; On change no longer runs after a failed save.
- Microflow image uploads take turns, never pick up the previous URL, and stop
  waiting when the action ends without one.
- Variables are inserted at the cursor.
- Ask for a URL says that a dropped or pasted image file can't be uploaded.
- Dark code blocks keep one readable colour in Outlook.com too.
- Sample values in the preview are escaped; tokens with HTML-special delimiters
  are found in the rendered HTML.
- The editor's controls render at full size in Atlas apps (10px root font).
- The widget sizes from its container, so pages no longer scroll sideways on phones.
- The Variable menu is no longer hidden behind the formatting toolbar and the
  image edit button.
