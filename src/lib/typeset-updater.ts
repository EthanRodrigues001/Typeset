import { getVersion } from "@tauri-apps/api/app";
import {
  check as checkTauriUpdate,
  type DownloadEvent,
  type Update,
} from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export const APP_VERSION = "1.0.2";

export type TypesetUpdate = Update;

export type UpdateProgress = {
  downloadedBytes: number;
  contentLength?: number;
  percent?: number;
};

export type UpdateCheckResult = {
  currentVersion: string;
  update: TypesetUpdate | null;
  latestVersion?: string;
  date?: string;
  body?: string;
  unsupported: boolean;
};

type WindowWithTauri = Window & {
  __TAURI_INTERNALS__?: unknown;
};

export function hasTauriRuntime() {
  return (
    typeof window !== "undefined" &&
    Boolean((window as WindowWithTauri).__TAURI_INTERNALS__)
  );
}

export async function getCurrentAppVersion() {
  if (!hasTauriRuntime()) {
    return APP_VERSION;
  }

  try {
    return await getVersion();
  } catch {
    return APP_VERSION;
  }
}

export async function checkForUpdate(): Promise<UpdateCheckResult> {
  const currentVersion = await getCurrentAppVersion();
  if (!hasTauriRuntime()) {
    return {
      currentVersion,
      update: null,
      unsupported: true,
    };
  }

  const update = await checkTauriUpdate();
  return {
    currentVersion,
    update,
    latestVersion: update?.version,
    date: update?.date,
    body: update?.body,
    unsupported: false,
  };
}

export async function downloadAndInstallUpdate(
  update: TypesetUpdate,
  onProgress: (progress: UpdateProgress) => void
) {
  let downloadedBytes = 0;
  let contentLength: number | undefined;

  await update.downloadAndInstall((event: DownloadEvent) => {
    if (event.event === "Started") {
      downloadedBytes = 0;
      contentLength = event.data.contentLength;
    } else if (event.event === "Progress") {
      downloadedBytes += event.data.chunkLength;
    }

    onProgress({
      downloadedBytes,
      contentLength,
      percent: contentLength
        ? Math.min(100, Math.round((downloadedBytes / contentLength) * 100))
        : undefined,
    });
  });
}

export async function relaunchOrExitAfterUpdate() {
  if (hasTauriRuntime()) {
    await relaunch();
  }
}
