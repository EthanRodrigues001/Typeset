# Contributing To Typeset

Thanks for wanting to improve Typeset. This project is open source and welcomes focused, well-tested contributions.

## Ways To Contribute

- Fix Markdown preview rendering bugs.
- Improve keyboard accessibility.
- Improve Windows packaging, signing, and file association behavior.
- Add tests for Rust path safety, note moves, and `LAYOUT.md` generation.
- Improve documentation and onboarding.
- Polish UI details while preserving the existing dark desktop app style.

## Development Setup

Install dependencies:

```powershell
npm install
```

Run the frontend:

```powershell
npm run dev
```

Run the desktop app:

```powershell
npm run tauri -- dev
```

Build the frontend:

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

## Project Rules

- Keep filesystem mutations in Rust IPC commands.
- Keep the Next.js frontend static-export compatible.
- Do not add API routes, Server Actions, or SSR-dependent behavior for app logic.
- Keep generated `LAYOUT.md` files protected from normal editing.
- Validate Windows names, reserved names, path traversal, and duplicate names ignoring case.
- External Markdown files must stay external until imported.
- Follow the current shadcn/ui and Tailwind style.
- Prefer focused changes over broad refactors.

## Pull Request Checklist

- Describe what changed and why.
- Include screenshots or recordings for UI changes.
- Mention any new or changed IPC commands.
- Run the relevant checks:

```powershell
npm run lint
npm run build
cd src-tauri
cargo check
cargo test
```

- Keep unrelated formatting churn out of the PR.
- Update README or CHANGELOG when behavior changes.

## Commit Style

Use short, direct commit messages:

```text
Fix markdown table overflow
Add workspace location picker
Document external file import flow
```

## Reporting Bugs

Please include:

- Windows version
- Typeset version
- steps to reproduce
- expected result
- actual result
- screenshots or logs if useful

Do not include private notes or sensitive file paths unless you have cleaned them first.
