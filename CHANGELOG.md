# Changelog

All notable changes to the Email Template Editor widget.

## [1.0.0] - unreleased

### Added
- Mendix 11 support (React 19.2.3, pluggable-widgets-tools 11.12).
- Full token property for Model Reflection `CombinedToken`s; `{%` and `%}` as
  default delimiters for the Email Connector.
- Send test action and toolbar button.
- Dark mode colours in the custom theme, written into the email on save, and a
  light/dark switch in the Preview.
- Column layouts stack on phones in the sent email and the preview.
- Readable names in the style panel's path, and an outline on the selected block.
- Maximum image size property; images only; https-only URLs in Ask for a URL.
- Studio Pro toolbox icon and tile, light and dark.
- Unit tests (`npm test`) and a CI workflow (lint, test, build).

### Fixed
- Edits typed while a save was rendering are no longer marked as saved.
- Automatic save no longer overwrites a version changed elsewhere while the
  banner asks the user to choose; On change no longer runs after a failed save.
- Microflow image uploads take turns, never pick up the previous URL, and stop
  waiting when the action ends without one.
- Variables are inserted at the cursor.
- Sample values in the preview are escaped; tokens with HTML-special delimiters
  are found in the rendered HTML.
- The editor's controls render at full size in Atlas apps (10px root font).
- The widget sizes from its container, so pages no longer scroll sideways on phones.
