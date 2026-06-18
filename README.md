# Typeset

Typeset is a Windows-first native Markdown workspace built with Tauri v2, Rust, Next.js, TypeScript, Tailwind, and shadcn/ui.

It is designed for fast local note work: browse Markdown files from a sidebar, create folders and sub-notes, edit source Markdown, preview rich Markdown, open external `.md` files from Windows, and maintain deterministic `LAYOUT.md` indexes that agents can read quickly.

## Features

- Native Windows desktop shell with Tauri v2.
- Static-exported Next.js frontend with TypeScript.
- Dark shadcn/ui interface inspired by compact desktop IDE layouts.
- Sidebar with Overview, Recent, and Folders sections.
- Managed Markdown workspace stored in a `.typeset` folder.
- Folder and note creation, rename, move, delete, drag/drop moves, and folder colors.
- Sub-note model using normal files and folders.
- CodeMirror Markdown source editor with undo, redo, save commands, and a floating command dock.
- Preview, Source, and Split modes.
- Markdown preview with GitHub Flavored Markdown, tables, task lists, code blocks, images, and Mermaid diagrams.
- Fullscreen preview dialogs for diagrams and images.
- Deterministic `LAYOUT.md` files in every folder for agent-friendly indexing.
- Windows `.md` file association for opening Markdown from anywhere on the PC.

## Workspace Model

On first launch, Typeset creates a managed workspace:

```text
Documents/.typeset
```

The workspace location can be changed in Settings. For safety, Typeset currently allows `.typeset` workspaces inside Documents, Desktop, or Downloads.

Typeset also seeds an empty/new workspace with:

```text
Getting Started/
  Getting Started.md
```

That starter note explains the app from inside the app and gives new users a safe file to edit.

## Notes And Sub-Notes

All managed notes are normal `.md` files.

```text
Topic.md
Topic/Child.md
Topic/Child/Grandchild.md
```

`Topic.md` is a parent note. A sub-note under it is stored inside the same-name companion folder, `Topic/`.

When a note is renamed, moved, or deleted, Typeset also handles its same-name child folder.

## Agent-Friendly Layout Indexes

Typeset writes a generated `LAYOUT.md` file in every folder. These files are hidden from normal note editing and regenerated after create, save, rename, move, delete, import, or sync actions.

Each `LAYOUT.md` contains:

- deterministic frontmatter
- a machine-readable JSON block between `TYPESET_INDEX_BEGIN` and `TYPESET_INDEX_END`
- a readable Markdown tree
- note metadata such as headings, tags, links, updated time, and byte size

This lets an agent inspect the workspace by reading folder-level indexes instead of walking and parsing every file first.

## Opening External Markdown

The packaged Windows app registers Typeset as an opener for `.md` files. From Explorer, use:

```text
Right click a .md file -> Open with -> Typeset
```

External files opened from anywhere on the PC are shown in Recent, but they are not shown in the Folders tree and are not indexed into the managed workspace.

Use Import inside Typeset when you want to copy an external Markdown file into `.typeset`.

## Tech Stack

- Tauri v2 and Rust for the native app, filesystem access, path validation, and Windows integration.
- Next.js static export for the desktop frontend.
- React and TypeScript for UI.
- shadcn/ui, Tailwind, and Lucide icons for the app shell and controls.
- CodeMirror 6 for Markdown source editing.
- react-markdown, remark-gfm, rehype-sanitize, rehype-highlight, and Mermaid for preview rendering.

## Development

Install dependencies:

```powershell
npm install
```

Run the web frontend only:

```powershell
npm run dev
```

Run the Tauri desktop app:

```powershell
npm run tauri -- dev
```

Build the static frontend:

```powershell
npm run build
```

Build the desktop bundle:

```powershell
npm run tauri -- build
```

Run Rust checks:

```powershell
cd src-tauri
cargo check
cargo test
```

## Windows Smart App Control

Unsigned local development builds may be blocked by Windows Smart App Control. That does not mean the code is malware. It means Windows cannot verify the publisher for the unsigned dev executable or generated build artifacts.

For contributors, use a development machine or VM where unsigned local builds are allowed. For releases, ship signed Windows artifacts from a trusted signing certificate so users can install and launch Typeset without this warning.

## Project Structure

```text
src/
  app/                 Next.js app routes and global styles
  components/          Typeset UI, Markdown preview, shadcn/ui components
  lib/                 Frontend IPC wrapper and utilities
src-tauri/
  src/lib.rs           Rust commands, workspace model, layout indexing
  tauri.conf.json      Tauri app, bundle, icon, and file association config
public/
  markdown-test/       Static Markdown syntax test assets
```

## Safety Rules

- Only `.md` notes are managed.
- `LAYOUT.md` is generated and cannot be edited as a normal note.
- Unsafe Windows names, reserved names, duplicates ignoring case, and path traversal are rejected.
- Rust owns filesystem operations through typed Tauri IPC.
- External files remain external until imported.

## License

No license file has been committed yet. Add a license before the first public release if this repository is intended to accept outside use or contributions.
