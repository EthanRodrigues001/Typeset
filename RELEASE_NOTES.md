# Typeset v1.0.1

Typeset v1.0.1 is the first updater-enabled baseline release. Users on v1.0.0 must install this release manually once. After v1.0.1 is installed, future releases can be detected from inside Typeset and installed through the Updates panel.

## What Is Included

- Tauri v2 updater and process plugins.
- GitHub Releases updater endpoint configuration.
- Signed updater artifact support through Tauri `createUpdaterArtifacts`.
- Settings Updates section with current version, latest version, release notes, status, and download progress.
- Sidebar Update button next to Settings when an update is available.
- Windows install warning before update install.
- GitHub Actions release workflow for Windows NSIS/MSI bundles, updater signatures, and `latest.json`.
- Branded NSIS installer icon, header image, and sidebar image.
- Sidebar drag/drop fixes with precise folder row drop targets and a drag overlay.

## Update Path

If you installed Typeset v1.0.0:

1. Download and run `Typeset_1.0.1_x64-setup.exe`.
2. Install it over the existing Typeset app.
3. Open Typeset and confirm Settings shows version `1.0.1`.
4. Future releases such as `1.0.2+` can be installed from the in-app Updates panel.

The v1.0.0 app cannot self-update because it did not include updater code.

## Windows Downloads

Published on GitHub Releases:

| File | Format | SHA-256 |
| --- | --- | --- |
| `Typeset_1.0.1_x64-setup.exe` | NSIS Windows installer | `31f25b729d97002d92ef2a2a10edf416bed91ef6be7dcfb3ef60c2200dd46374` |
| `Typeset_1.0.1_x64_en-US.msi` | MSI Windows installer | `42bb70db598e4e46c84df3e72b966b795fe2c35141bf890e59c4c8be91b0c2e5` |

Release URL: <https://github.com/EthanRodrigues001/Typeset/releases/tag/v1.0.1>

## Updater Release Assets

The GitHub Actions release workflow uploads:

- `latest.json`
- updater `.sig` files for the Windows installer artifact

These are required for in-app updates from v1.0.1 to later versions.

## Known Notes

- Windows is the primary supported target.
- The app is configured for updater signing; the release workflow generates and uploads the `.sig` files.
- Windows Smart App Control may warn or block unsigned installers on strict systems.
- The updater signing private key must stay outside the repo and be stored as the GitHub Actions secret `TAURI_SIGNING_PRIVATE_KEY_B64`.

## Validation

- `npm run lint`
- `npm run build`
- `cargo check`
- `cargo test --lib -- --nocapture`
- GitHub Actions Release run `27814730665` built and published the Windows NSIS/MSI artifacts, updater signatures, and `latest.json`.
