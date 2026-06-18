# Security Policy

## Supported Versions

Security fixes are accepted for the latest released version of Typeset.

| Version | Supported |
| --- | --- |
| 1.x | Yes |

## Reporting A Vulnerability

Please do not open a public GitHub issue for security-sensitive reports.

Email the maintainer or open a private GitHub security advisory if available on the repository. Include:

- affected version
- operating system
- steps to reproduce
- impact
- suggested fix, if known

## Security Model

Typeset is a local-first desktop app.

- Rust owns filesystem operations through Tauri IPC.
- Managed notes are limited to the configured `.typeset` workspace.
- External Markdown files stay external until imported.
- `LAYOUT.md` files are generated and protected from normal editing.
- Path traversal, unsafe Windows names, reserved names, and duplicate names ignoring case are rejected.
- Markdown preview uses sanitization for HTML.

## Out Of Scope

- User-controlled Markdown intentionally shown to the same local user.
- Unsigned local development builds blocked by Windows Smart App Control.
- Issues caused by modifying generated files outside Typeset.
