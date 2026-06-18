import { invoke } from "@tauri-apps/api/core";

export type NodeKind = "folder" | "note";

export type TreeNode = {
  id: string;
  kind: NodeKind;
  name: string;
  path: string;
  children: TreeNode[];
  hasChildren: boolean;
  bytes: number;
  ownBytes: number;
  noteCount: number;
  folderCount: number;
  updatedAt?: string;
};

export type WorkspaceInfo = {
  rootPath: string;
  layoutPath: string;
  tree: TreeNode[];
};

export type WorkspaceSettings = {
  rootPath: string;
  defaultRootPath: string;
  allowedRoots: string[];
  workspaceFolder: string;
};

export type NoteDocument = {
  path: string;
  name: string;
  content: string;
  external: boolean;
};

export type LayoutSyncResult = {
  rootPath: string;
  layoutsWritten: number;
};

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function call<T>(command: string, args?: Record<string, unknown>) {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw new Error(messageFromError(error));
  }
}

export const typesetApi = {
  initWorkspace: () => call<WorkspaceInfo>("init_workspace"),
  getWorkspaceSettings: () =>
    call<WorkspaceSettings>("get_workspace_settings"),
  setWorkspaceLocation: (path: string) =>
    call<WorkspaceInfo>("set_workspace_location", { path }),
  listTree: () => call<TreeNode[]>("list_tree"),
  readNote: (path: string) => call<NoteDocument>("read_note", { path }),
  saveNote: (path: string, content: string) =>
    call<NoteDocument>("save_note", { path, content }),
  createNote: (parent: string, name: string) =>
    call<TreeNode>("create_note", { parent, name }),
  createSubNote: (parentNote: string, name: string) =>
    call<TreeNode>("create_sub_note", { parentNote, name }),
  createFolder: (parent: string, name: string) =>
    call<TreeNode>("create_folder", { parent, name }),
  renameNode: (path: string, newName: string) =>
    call<void>("rename_node", { path, newName }),
  moveNode: (path: string, newParent: string) =>
    call<void>("move_node", { path, newParent }),
  deleteNode: (path: string) => call<void>("delete_node", { path }),
  syncLayouts: () => call<LayoutSyncResult>("sync_layouts"),
  openExternalNote: (path: string) =>
    call<NoteDocument>("open_external_note", { path }),
  importExternalNote: (
    externalPath: string,
    destinationParent: string,
    name?: string
  ) =>
    call<TreeNode>("import_external_note", {
      externalPath,
      destinationParent,
      name,
    }),
  takeStartupFiles: () => call<string[]>("take_startup_files"),
};
