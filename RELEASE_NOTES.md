# Typeset v1.0.3

Typeset v1.0.3 adds a local Context graph for README-driven workspace knowledge and improves the Markdown preview outline menu.

## What Is Included

- Added a Context tab under Workspace with a dark 2D Obsidian-style graph.
- Indexed only workspace `README.md` files plus generated `LAYOUT.md` metadata for fast, lightweight context discovery.
- Generated a protected root `CONTEXT.md` file with frontmatter, machine-readable JSON, and a readable context outline.
- Added Context graph search/filtering by folder, README title, heading, tag, linked note, and path.
- Added node details with summary, headings, tags, outbound links, and Open README actions.
- Added Refresh Index to rebuild context metadata without restarting Typeset.
- Auto-created `CONTEXT.md` for existing workspaces during startup/sync, so updated users do not need a manual migration.
- Fixed the Markdown preview On this page menu to use the app theme instead of the yellow highlight.
- Moved the On this page button/panel into the preview's top-right corner as an overlay.

## Updating From v1.0.2

If you installed Typeset v1.0.2, open Typeset and use the in-app Updates panel or the sidebar Update button when it appears.

If the updater does not appear, install the latest Windows setup executable manually from GitHub Releases. The app will keep your managed workspace data separate from the installed application.

## Windows Downloads

The GitHub Actions release workflow publishes:

- `Typeset_1.0.3_x64-setup.exe`
- `Typeset_1.0.3_x64_en-US.msi`
- updater `.sig` files
- `latest.json`

## Known Notes

- Windows is the primary supported target.
- Windows Smart App Control may warn or block unsigned installers on strict systems.
- The updater install flow requires signed updater metadata from GitHub Releases.
