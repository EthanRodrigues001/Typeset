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

Attach these files to the GitHub release:

| File | Format | SHA-256 |
| --- | --- | --- |
| `Typeset_1.0.1_x64-setup.exe` | NSIS Windows installer | `4F7BBC2F9AB34BBD220D3424D1235C8DD4FC1B6EB1B642ACAEAE62DCD6790B40` |
| `Typeset_1.0.1_x64_en-US.msi` | MSI Windows installer | `0C44AFECC54532B9196964997ECA8D38DD2810400B101D9DC204F962B463AC0E` |

The local build produced these artifacts at:

```text
C:\tmp\typeset-release-target\release\bundle\nsis\Typeset_1.0.1_x64-setup.exe
C:\tmp\typeset-release-target\release\bundle\msi\Typeset_1.0.1_x64_en-US.msi
```

## Updater Release Assets

The GitHub Actions release workflow should also upload:

- `latest.json`
- updater `.sig` files for the Windows installer artifact

These are required for in-app updates from v1.0.1 to later versions.

## Known Notes

- Windows is the primary supported target.
- The app is configured for updater signing; the release workflow must generate and upload the actual `.sig` files.
- Windows Smart App Control may warn or block unsigned installers on strict systems.
- The updater signing private key must stay outside the repo and be stored as the GitHub Actions secret `TAURI_SIGNING_PRIVATE_KEY_B64`.

## Validation

- `npm run lint`
- `npm run build`
- `cargo check`
- `cargo test --lib -- --nocapture`
- `npm run tauri -- build` produced Windows NSIS/MSI artifacts locally, but the rerun to regenerate updater metadata was blocked by the current sandbox usage limit.
