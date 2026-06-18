# Typeset v1.0.0

Typeset v1.0.0 is the first open-source release of the Windows-first native Markdown workspace.

## What Is Included

- Native desktop app built with Tauri v2 and Rust.
- Static Next.js and TypeScript frontend.
- Dark shadcn/ui app shell.
- Managed `.typeset` Markdown workspace.
- First-run Getting Started note.
- Sidebar with Overview, Recent, and Folders.
- Markdown note, sub-note, and folder management.
- Drag/drop move support.
- Folder color choices.
- CodeMirror Markdown source editor.
- Preview, Source, and Split modes.
- Undo, redo, and save commands.
- Markdown preview with GFM, tables, task lists, code, images, footnotes, safe HTML, and Mermaid diagrams.
- Fullscreen image and Mermaid preview dialogs.
- Windows `.md` file association.
- External Markdown files in Recent, with Import to copy into the managed workspace.
- Deterministic `LAYOUT.md` indexes for agents.
- Native folder picker for move and workspace location settings.
- MIT license, contribution guide, security policy, changelog, and GitHub issue templates.

## Known Notes

- Windows is the primary supported target for v1.
- Unsigned local builds may be blocked by Windows Smart App Control.
- Public release artifacts should be signed before broad distribution.
- External Markdown files remain external until imported.

## Windows Downloads

Attach these files to the GitHub release:

| File | Format | SHA-256 |
| --- | --- | --- |
| `Typeset_1.0.0_x64-setup.exe` | NSIS Windows installer | `92A12A85827663D158F1A294FE63763F214D7494B20441134E0444E73DA456F4` |
| `Typeset_1.0.0_x64_en-US.msi` | MSI Windows installer | `C5856E5CEDFEA243F8EC7DD3510DEC4F3F2863FB8AF8A446906F28B6718ACB80` |

The local build produced these artifacts at:

```text
C:\tmp\typeset-tauri-target\release\bundle\nsis\Typeset_1.0.0_x64-setup.exe
C:\tmp\typeset-tauri-target\release\bundle\msi\Typeset_1.0.0_x64_en-US.msi
```

## Validation

- `npm run lint`
- `npm run build`
- `cargo check`
- `cargo test`
- `npm run tauri -- build`
