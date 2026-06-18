# Changelog

All notable changes to Typeset will be documented in this file.

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
