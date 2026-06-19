# Changelog

All notable changes to Typeset will be documented in this file.

## Unreleased

No unreleased changes yet.

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
