# Typeset v1.0.2

Typeset v1.0.2 is a small updater smoke-test release for users who installed the updater-enabled v1.0.1 baseline.

## What Is Included

- Added an On this page menu in Markdown preview and split preview.
- Added heading jumps for quickly locating sections in long Markdown files.
- Preserved preview/source/split scroll positions after edits, saves, and preview re-renders.

## Update Test Path

If you installed Typeset v1.0.1:

1. Open Typeset.
2. Wait for the startup update check, or open Settings and check Updates manually.
3. Confirm Typeset shows v1.0.2 as available.
4. Click Update, let it download/install, then reopen Typeset.
5. Confirm Settings shows version `1.0.2`.

If you are still on v1.0.0, install v1.0.1 or newer manually once because v1.0.0 did not include updater code.

## Windows Downloads

The GitHub Actions release workflow publishes:

- `Typeset_1.0.2_x64-setup.exe`
- `Typeset_1.0.2_x64_en-US.msi`
- updater `.sig` files
- `latest.json`

## Known Notes

- Windows is the primary supported target.
- Windows Smart App Control may warn or block unsigned installers on strict systems.
- The updater install flow requires signed updater metadata from GitHub Releases.
