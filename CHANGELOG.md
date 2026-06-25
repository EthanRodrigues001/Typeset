# Changelog

All notable changes to Typeset will be documented in this file.

## Unreleased

No unreleased changes yet.

## 1.0.4 - 2026-06-26

### Changed

- Rebuilt the Context graph as a real Markdown metadata index instead of a README-only visual.
- Indexed every managed Markdown file with headings, tags, links, updated time, and byte size for faster agent search.
- Updated generated `CONTEXT.md` with counts, a fast-search guide, README context, and all indexed Markdown files.
- Simplified the Context view layout by removing the extra bordered card treatment.

### Fixed

- Fixed Context graph counts so the folder badge excludes the root workspace folder and the primary badge shows indexed Markdown files.
- Fixed graph canvas sizing so nodes and labels stay inside the graph panel instead of overflowing under the details panel.
- Fixed oversized graph labels by capping label rendering while zoomed out.
- Fixed the Markdown preview On this page menu so it stays pinned at the top right while scrolling.

## 1.0.3 - 2026-06-26

### Added

- Added a Context workspace tab with a local 2D graph of README, folder, note, heading, tag, and link context.
- Added automatic README/Layout indexing into generated root `CONTEXT.md` for agent-friendly workspace discovery.
- Added Context graph search, node details, refresh index, and Open README actions.

### Changed

- Existing workspaces now create or refresh `CONTEXT.md` automatically during startup and workspace sync, so updated users do not need to migrate manually.
- `CONTEXT.md` is treated as generated Typeset metadata and hidden/protected like `LAYOUT.md`.

### Fixed

- Restyled the Markdown preview On this page menu so the active heading uses the app theme instead of a hard-coded yellow accent.
- Repositioned the On this page control as a top-right overlay that does not push preview content around.

## 1.0.2 - 2026-06-19

### Added

- Added an On this page menu in Markdown preview and split preview for quickly jumping to headings.

### Fixed

- Preserved preview, source, and split-pane scroll positions after edits, saves, and preview re-renders.

## 1.0.1 - 2026-06-19

### Added

- Added Tauri v2 updater and process plugins for in-app update checks, downloads, installs, and relaunch.
- Added signed updater artifact configuration with GitHub Releases endpoint support.
- Added an Updates section in Settings with current version, latest version, release notes, status, and progress.
- Added a sidebar Update button that appears next to Settings only when an update has been confirmed available.
- Added a GitHub Actions release workflow that builds Windows NSIS/MSI artifacts, updater signatures, and `latest.json`.
- Added branded NSIS installer artwork and installer/uninstaller icons.

### Changed

- Bumped app, package, and Rust crate versions to `1.0.1` as the first updater-enabled baseline.
- Documented that `1.0.0` users must manually install `1.0.1` before future in-app updates can work.

### Fixed

- Fixed sidebar drag/drop by using precise folder row drop targets, a drag overlay, and safer invalid-drop handling.
- Fixed the release workflow to normalize and validate updater signing keys before building signed updater artifacts.

## 1.0.0 - 2026-06-18

### Added

- Tauri v2 desktop app shell for Windows.
- Static-exported Next.js frontend with TypeScript.
- shadcn/ui dark desktop interface.
- Sidebar with Overview, Recent, and Folders sections.
- Managed `.typeset` Markdown workspace.
- First-run `Getting Started/Getting Started.md` note for empty workspaces.
- Markdown note, sub-note, and folder creation.
- Rename, move, delete, drag/drop moves, and folder color choices.
- CodeMirror Markdown source editor.
- Preview, Source, and Split modes.
- Undo, redo, save shortcuts, and floating editor command dock.
- Markdown preview with GFM, task lists, tables, code blocks, images, footnotes, safe HTML, and Mermaid diagrams.
- Fullscreen dialogs for images and Mermaid diagrams.
- External `.md` opening from Windows file association.
- Import flow for external Markdown files.
- Deterministic `LAYOUT.md` indexes in every workspace folder.
- Workspace location settings with native folder browsing.
- Open-source documentation, contribution guide, security policy, issue templates, and MIT license.

### Changed

- Limited workspace locations to safe user folders.
- Kept external Markdown files in Recent without adding them to the managed folder tree.
- Simplified folder cards and folder icon animation.
- Disabled default WebView context menu and devtools inspect shortcuts.

### Fixed

- Protected generated `LAYOUT.md` files from normal note editing.
- Rebuilt layout indexes after note and folder mutations.
- Removed stale recent-note entries after move, rename, and delete operations.
- Improved large Markdown preview performance and split-view scroll syncing.
- Fixed Mermaid diagram text contrast for the dark theme.
- Hid unwanted scrollbars in editor, preview tables, and code blocks.

## 0.1.0 - 2026-06-18

- Initial development baseline.
