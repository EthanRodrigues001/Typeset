# Typeset v1.0.4

Typeset v1.0.4 fixes the Context graph so it becomes a useful local Markdown search index, and pins the Markdown preview On this page menu while scrolling.

## What Is Included

- Context graph now indexes every managed Markdown file, not only README files.
- Normal notes now contribute headings, tags, links, update time, and byte size to the graph and generated `CONTEXT.md`.
- README files still receive short summaries, but the graph can now search across the rest of the workspace metadata too.
- `CONTEXT.md` now includes Markdown/readme/folder counts, a fast-search guide, README context, and all indexed Markdown files.
- Context graph badges now show indexed MD files, README files, and folders excluding the root workspace folder.
- Graph rendering now sizes to the actual graph pane so it does not overflow under the details panel.
- Graph labels are capped and hidden while zoomed out, preventing giant overlapping text.
- Context view no longer has the extra nested bordered card look.
- The Markdown preview On this page button now stays pinned at the top right while scrolling.

## Updating From v1.0.3

Open Typeset and use the in-app update prompt or Settings -> Updates. After updating, use Refresh Index in the Context tab once if the old graph is still open from the previous app session.

## Windows Downloads

The GitHub Actions release workflow publishes:

- `Typeset_1.0.4_x64-setup.exe`
- `Typeset_1.0.4_x64_en-US.msi`
- updater `.sig` files
- `latest.json`

## Known Notes

- Windows is the primary supported target.
- Windows Smart App Control may warn or block unsigned installers on strict systems.
- The updater install flow requires signed updater metadata from GitHub Releases.
