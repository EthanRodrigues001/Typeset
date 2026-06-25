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

export type ContextNodeKind =
  | "workspace"
  | "folder"
  | "readme"
  | "heading"
  | "note"
  | "tag";

export type ContextHeading = {
  level: number;
  text: string;
  slug: string;
};

export type ContextNode = {
  id: string;
  kind: ContextNodeKind;
  label: string;
  path?: string;
  title?: string;
  summary?: string;
  headings?: ContextHeading[];
  tags?: string[];
  links?: string[];
  updatedAt?: string;
  bytes?: number;
};

export type ContextEdgeKind =
  | "contains"
  | "has_readme"
  | "has_heading"
  | "links_to"
  | "tagged";

export type ContextEdge = {
  id: string;
  source: string;
  target: string;
  kind: ContextEdgeKind;
  label?: string;
};

export type ContextGraph = {
  version: number;
  workspaceRoot: string;
  generatedAt: string;
  nodes: ContextNode[];
  edges: ContextEdge[];
};

export type ContextIndexResult = {
  rootPath: string;
  contextPath: string;
  nodesIndexed: number;
  edgesIndexed: number;
  readmeCount: number;
  layoutsWritten: number;
  graph: ContextGraph;
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
  getContextGraph: () => call<ContextGraph>("get_context_graph"),
  syncContextIndex: () => call<ContextIndexResult>("sync_context_index"),
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
