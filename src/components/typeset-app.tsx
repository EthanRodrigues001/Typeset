"use client";

import * as React from "react";
import CodeMirror from "@uiw/react-codemirror";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { markdown } from "@codemirror/lang-markdown";
import { Prec } from "@codemirror/state";
import { redo, redoDepth, undo, undoDepth } from "@codemirror/commands";
import { EditorView, keymap } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { listen } from "@tauri-apps/api/event";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  DownloadIcon,
  FilePlusIcon,
  FileTextIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  GripVerticalIcon,
  HardDriveIcon,
  ImportIcon,
  PaletteIcon,
  PlusIcon,
  Redo2Icon,
  RefreshCwIcon,
  SaveIcon,
  SearchIcon,
  SettingsIcon,
  SplitSquareHorizontalIcon,
  Trash2Icon,
  Undo2Icon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { MarkdownPreview } from "@/components/markdown-preview";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  FolderBadge,
  FOLDER_COLOR_OPTIONS,
  normalizeFolderColor,
  type FolderColorKey,
} from "@/components/folder-badge";
import { cn } from "@/lib/utils";
import type { NoteDocument, TreeNode, WorkspaceSettings } from "@/lib/typeset-api";
import { typesetApi } from "@/lib/typeset-api";
import {
  APP_VERSION,
  checkForUpdate,
  downloadAndInstallUpdate,
  getCurrentAppVersion,
  hasTauriRuntime,
  relaunchOrExitAfterUpdate,
  type TypesetUpdate,
} from "@/lib/typeset-updater";
import {
  WorkspaceOverview,
  type RecentNote,
} from "@/components/workspace-overview";

type ViewMode = "preview" | "source" | "split";
type CreateKind = "note" | "folder" | "sub-note";
type ActiveSurface = "overview" | "document";

type ScrollSyncTarget = {
  line: number;
  ratio: number;
};

type EditorScrollController = {
  scrollToLine: (line: number) => void;
  scrollToRatio: (ratio: number) => void;
};

type EditorCommandAction = "undo" | "redo" | "save";

type EditorHistoryState = {
  canUndo: boolean;
  canRedo: boolean;
};

type EditorCommandController = {
  undo: () => boolean;
  redo: () => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
  focus: () => void;
};

type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "up-to-date"
  | "unsupported"
  | "downloading"
  | "installing"
  | "error";

type UpdateUiState = {
  status: UpdateStatus;
  currentVersion: string;
  latestVersion?: string;
  body?: string;
  date?: string;
  error?: string;
  downloadedBytes: number;
  contentLength?: number;
  percent?: number;
};

type PreviewAnchor = {
  line: number;
  top: number;
};

const EMPTY_EDITOR_HISTORY: EditorHistoryState = {
  canUndo: false,
  canRedo: false,
};

const EMPTY_EDITOR_COMMANDS: EditorCommandController = {
  undo: () => false,
  redo: () => false,
  canUndo: () => false,
  canRedo: () => false,
  focus: () => {},
};

const DEFAULT_UPDATE_STATE: UpdateUiState = {
  status: "idle",
  currentVersion: APP_VERSION,
  downloadedBytes: 0,
};

const markdownEditorTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      backgroundColor: "var(--background)",
      color: "var(--foreground)",
      fontSize: "0.875rem",
    },
    "&.cm-focused": {
      outline: "none",
    },
    ".cm-content": {
      minHeight: "100%",
      padding: "1rem 0",
      caretColor: "var(--foreground)",
      overflowWrap: "anywhere",
    },
    ".cm-line": {
      padding: "0 1rem",
    },
    ".cm-scroller": {
      fontFamily: "var(--font-mono)",
      lineHeight: "1.7",
      overflowX: "hidden",
      scrollbarWidth: "none",
    },
    ".cm-scroller::-webkit-scrollbar": {
      display: "none",
    },
    ".cm-gutters": {
      backgroundColor: "var(--background)",
      borderRight: "1px solid var(--border)",
      color: "var(--muted-foreground)",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      minWidth: "2.75rem",
      padding: "0 0.75rem 0 0.5rem",
    },
    ".cm-activeLine": {
      backgroundColor: "color-mix(in oklch, var(--muted), transparent 45%)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "color-mix(in oklch, var(--muted), transparent 45%)",
      color: "var(--foreground)",
    },
    "&.cm-focused .cm-cursor": {
      borderLeftColor: "var(--foreground)",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      {
        backgroundColor: "color-mix(in oklch, var(--primary), transparent 72%)",
      },
    ".cm-foldPlaceholder": {
      backgroundColor: "var(--muted)",
      border: "1px solid var(--border)",
      borderRadius: "0.375rem",
      color: "var(--muted-foreground)",
    },
    ".cm-matchingBracket, .cm-nonmatchingBracket": {
      backgroundColor: "color-mix(in oklch, var(--primary), transparent 82%)",
      outline: "1px solid var(--border)",
    },
    ".cm-tooltip": {
      backgroundColor: "var(--popover)",
      border: "1px solid var(--border)",
      borderRadius: "0.5rem",
      color: "var(--popover-foreground)",
    },
  },
  { dark: true }
);

const markdownHighlightStyle = HighlightStyle.define([
  { tag: tags.heading, color: "var(--foreground)", fontWeight: "700" },
  { tag: tags.strong, color: "var(--foreground)", fontWeight: "700" },
  { tag: tags.emphasis, color: "#c4b5fd", fontStyle: "italic" },
  {
    tag: [tags.link, tags.url],
    color: "#60a5fa",
    textDecoration: "underline",
    textUnderlineOffset: "0.18rem",
  },
  { tag: tags.monospace, color: "#fbbf24" },
  { tag: [tags.quote, tags.comment], color: "#a1a1aa", fontStyle: "italic" },
  { tag: [tags.keyword, tags.atom, tags.bool], color: "#c4b5fd" },
  { tag: [tags.string, tags.special(tags.string)], color: "#86efac" },
  { tag: [tags.number, tags.integer, tags.float], color: "#fbbf24" },
  { tag: [tags.variableName, tags.propertyName], color: "#e5e7eb" },
  { tag: [tags.function(tags.variableName), tags.definition(tags.variableName)], color: "#93c5fd" },
  { tag: [tags.tagName, tags.attributeName], color: "#f0abfc" },
  { tag: tags.punctuation, color: "var(--muted-foreground)" },
  { tag: tags.meta, color: "#94a3b8" },
  { tag: tags.invalid, color: "var(--destructive)" },
]);

const markdownEditorExtensions = [
  markdown(),
  EditorView.lineWrapping,
  syntaxHighlighting(markdownHighlightStyle),
];

type CreateDialogState =
  | {
      open: true;
      kind: CreateKind;
      parent: string;
      parentNote?: string;
    }
  | { open: false };

type RenameDialogState =
  | {
      open: true;
      node: TreeNode;
      value: string;
    }
  | { open: false };

type MoveDialogState =
  | {
      open: true;
      node: TreeNode;
      destination: string;
    }
  | { open: false };

type DeleteDialogState =
  | {
      open: true;
      node: TreeNode;
    }
  | { open: false };

function firstNote(nodes: TreeNode[]): TreeNode | undefined {
  for (const node of nodes) {
    if (node.kind === "note") {
      return node;
    }
    const child = firstNote(node.children);
    if (child) {
      return child;
    }
  }
}

function findNodeByPath(nodes: TreeNode[], path: string): TreeNode | undefined {
  for (const node of nodes) {
    if (node.path === path) {
      return node;
    }
    const child = findNodeByPath(node.children, path);
    if (child) {
      return child;
    }
  }
}

function findNotesByName(nodes: TreeNode[], name: string): TreeNode[] {
  const normalizedName = name.toLowerCase();
  const matches: TreeNode[] = [];
  for (const node of nodes) {
    if (node.kind === "note" && node.name.toLowerCase() === normalizedName) {
      matches.push(node);
    }
    matches.push(...findNotesByName(node.children, name));
  }
  return matches;
}

function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return nodes;
  }

  return nodes
    .map((node) => {
      const children = filterTree(node.children, trimmed);
      const matches =
        node.name.toLowerCase().includes(trimmed) ||
        node.path.toLowerCase().includes(trimmed);
      return matches || children.length ? { ...node, children } : null;
    })
    .filter((node): node is TreeNode => Boolean(node));
}

function parentPath(path: string) {
  const index = path.lastIndexOf("/");
  return index === -1 ? "" : path.slice(0, index);
}

function displayPath(path: string) {
  return path || ".";
}

async function browseFolder(title: string, defaultPath?: string) {
  if (!hasTauriRuntime()) {
    toast.error("Folder browsing is available in the desktop app");
    return null;
  }

  const selected = await openDialog({
    title,
    directory: true,
    multiple: false,
    defaultPath: defaultPath || undefined,
  });

  return typeof selected === "string" ? selected : null;
}

function normalizeNativePath(path: string) {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

function workspaceRelativePath(workspaceRoot: string, selectedPath: string) {
  const root = normalizeNativePath(workspaceRoot);
  const selected = normalizeNativePath(selectedPath);
  if (!root || !selected) {
    return null;
  }

  const rootKey = root.toLowerCase();
  const selectedKey = selected.toLowerCase();
  if (selectedKey === rootKey) {
    return "";
  }
  if (selectedKey.startsWith(`${rootKey}/`)) {
    return selected.slice(root.length + 1);
  }

  return null;
}

function nodeChildPrefix(node: TreeNode) {
  if (node.kind === "folder") {
    return node.path;
  }
  return node.path.toLowerCase().endsWith(".md")
    ? node.path.slice(0, -3)
    : node.path;
}

function nodeContainsPath(node: TreeNode, path: string) {
  if (path === node.path) {
    return true;
  }
  const prefix = nodeChildPrefix(node);
  return Boolean(prefix) && path.startsWith(`${prefix}/`);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function dropWouldMoveNodeIntoItself(node: TreeNode, destinationParent: string) {
  if (!destinationParent) {
    return false;
  }

  if (node.kind === "folder") {
    return (
      destinationParent === node.path ||
      destinationParent.startsWith(`${node.path}/`)
    );
  }

  const companionPrefix = nodeChildPrefix(node);
  return (
    destinationParent === companionPrefix ||
    destinationParent.startsWith(`${companionPrefix}/`)
  );
}

const RECENT_NOTES_STORAGE_KEY = "typeset:recent-notes";
const FOLDER_COLORS_STORAGE_KEY = "typeset:folder-colors";
const LOCAL_STORAGE_CHANGE_EVENT = "typeset:local-storage-change";
const EMPTY_RECENT_NOTES: RecentNote[] = [];
const EMPTY_FOLDER_COLORS: Record<string, FolderColorKey> = {};
const folderColorKeys = FOLDER_COLOR_OPTIONS.map((option) => option.key);
let recentNotesCacheRaw: string | null = null;
let recentNotesCache: RecentNote[] = EMPTY_RECENT_NOTES;
let folderColorsCacheRaw: string | null = null;
let folderColorsCache: Record<string, FolderColorKey> = EMPTY_FOLDER_COLORS;

function noteTitle(name: string) {
  return name.toLowerCase().endsWith(".md") ? name.slice(0, -3) : name;
}

function parseRecentNotes(value: string | null): RecentNote[] {
  try {
    if (!value) {
      return EMPTY_RECENT_NOTES;
    }
    const parsed = JSON.parse(value) as RecentNote[];
    return Array.isArray(parsed)
      ? parsed
          .filter(
            (note) =>
              typeof note.path === "string" &&
              typeof note.name === "string" &&
              typeof note.openedAt === "string"
          )
          .slice(0, 8)
      : EMPTY_RECENT_NOTES;
  } catch {
    return EMPTY_RECENT_NOTES;
  }
}

function getRecentNotesSnapshot() {
  if (typeof window === "undefined") {
    return EMPTY_RECENT_NOTES;
  }
  const raw = window.localStorage.getItem(RECENT_NOTES_STORAGE_KEY);
  if (raw !== recentNotesCacheRaw) {
    recentNotesCacheRaw = raw;
    recentNotesCache = parseRecentNotes(raw);
  }
  return recentNotesCache;
}

function writeRecentNotes(notes: RecentNote[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(RECENT_NOTES_STORAGE_KEY, JSON.stringify(notes));
    emitLocalStorageChange(RECENT_NOTES_STORAGE_KEY);
  }
}

function parseFolderColors(value: string | null): Record<string, FolderColorKey> {
  try {
    if (!value) {
      return EMPTY_FOLDER_COLORS;
    }
    const parsed = JSON.parse(value) as Record<string, string>;
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([path]) => path)
        .map(([path, color]) => [path, normalizeFolderColor(color)])
    );
  } catch {
    return EMPTY_FOLDER_COLORS;
  }
}

function getFolderColorsSnapshot() {
  if (typeof window === "undefined") {
    return EMPTY_FOLDER_COLORS;
  }
  const raw = window.localStorage.getItem(FOLDER_COLORS_STORAGE_KEY);
  if (raw !== folderColorsCacheRaw) {
    folderColorsCacheRaw = raw;
    folderColorsCache = parseFolderColors(raw);
  }
  return folderColorsCache;
}

function writeFolderColors(colors: Record<string, FolderColorKey>) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(FOLDER_COLORS_STORAGE_KEY, JSON.stringify(colors));
    emitLocalStorageChange(FOLDER_COLORS_STORAGE_KEY);
  }
}

function emitLocalStorageChange(key: string) {
  window.dispatchEvent(
    new CustomEvent(LOCAL_STORAGE_CHANGE_EVENT, {
      detail: key,
    })
  );
}

function subscribeLocalStorageKey(key: string, callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }
  const handleStorage = (event: StorageEvent) => {
    if (event.key === key) {
      callback();
    }
  };
  const handleLocalChange = (event: Event) => {
    if (event instanceof CustomEvent && event.detail === key) {
      callback();
    }
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(LOCAL_STORAGE_CHANGE_EVENT, handleLocalChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(LOCAL_STORAGE_CHANGE_EVENT, handleLocalChange);
  };
}

function useRecentNotes() {
  return React.useSyncExternalStore(
    (callback) => subscribeLocalStorageKey(RECENT_NOTES_STORAGE_KEY, callback),
    getRecentNotesSnapshot,
    () => EMPTY_RECENT_NOTES
  );
}

function useFolderColors() {
  return React.useSyncExternalStore(
    (callback) => subscribeLocalStorageKey(FOLDER_COLORS_STORAGE_KEY, callback),
    getFolderColorsSnapshot,
    () => EMPTY_FOLDER_COLORS
  );
}

function fallbackFolderColor(path: string): FolderColorKey {
  let hash = 0;
  for (const character of path) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  }
  return folderColorKeys[Math.abs(hash) % folderColorKeys.length] ?? "violet";
}

export function TypesetApp() {
  const [workspaceRoot, setWorkspaceRoot] = React.useState("");
  const [tree, setTree] = React.useState<TreeNode[]>([]);
  const [selected, setSelected] = React.useState<NoteDocument | null>(null);
  const [content, setContent] = React.useState("");
  const [mode, setMode] = React.useState<ViewMode>("split");
  const [activeSurface, setActiveSurface] =
    React.useState<ActiveSurface>("document");
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [workspaceSettings, setWorkspaceSettings] =
    React.useState<WorkspaceSettings | null>(null);
  const [workspaceLocation, setWorkspaceLocation] = React.useState("");
  const [editorHistory, setEditorHistory] =
    React.useState<EditorHistoryState>(EMPTY_EDITOR_HISTORY);
  const editorCommandsRef =
    React.useRef<EditorCommandController>(EMPTY_EDITOR_COMMANDS);
  const [editorCommandDockClosed, setEditorCommandDockClosed] =
    React.useState(false);
  const [lastEditorCommand, setLastEditorCommand] =
    React.useState<EditorCommandAction | null>(null);
  const [updateDialogOpen, setUpdateDialogOpen] = React.useState(false);
  const [updateState, setUpdateState] =
    React.useState<UpdateUiState>(DEFAULT_UPDATE_STATE);
  const pendingUpdateRef = React.useRef<TypesetUpdate | null>(null);
  const updateToastShownRef = React.useRef(false);
  const recentNotes = useRecentNotes();
  const folderColors = useFolderColors();
  const [createDialog, setCreateDialog] = React.useState<CreateDialogState>({
    open: false,
  });
  const [createName, setCreateName] = React.useState("");
  const [renameDialog, setRenameDialog] = React.useState<RenameDialogState>({
    open: false,
  });
  const [moveDialog, setMoveDialog] = React.useState<MoveDialogState>({
    open: false,
  });
  const [deleteDialog, setDeleteDialog] = React.useState<DeleteDialogState>({
    open: false,
  });
  const [savedContent, setSavedContent] = React.useState("");
  const [draggingNode, setDraggingNode] = React.useState<TreeNode | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );
  const filteredTree = React.useMemo(() => filterTree(tree, query), [tree, query]);
  const dirty = selected ? content !== savedContent : false;

  React.useEffect(() => {
    const preventNativeContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };
    const preventInspectorShortcuts = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const isInspectorShortcut =
        event.key === "F12" ||
        (event.ctrlKey && event.shiftKey && ["i", "j", "c"].includes(key));

      if (!isInspectorShortcut) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener("contextmenu", preventNativeContextMenu);
    window.addEventListener("keydown", preventInspectorShortcuts, {
      capture: true,
    });
    return () => {
      window.removeEventListener("contextmenu", preventNativeContextMenu);
      window.removeEventListener("keydown", preventInspectorShortcuts, {
        capture: true,
      });
    };
  }, []);

  const rememberRecent = React.useCallback((document: NoteDocument) => {
    const nextNote: RecentNote = {
      path: document.path,
      name: document.name,
      external: document.external,
      openedAt: new Date().toISOString(),
    };
    const current = getRecentNotesSnapshot();
    const next = [
      nextNote,
      ...current.filter(
        (note) =>
          note.path !== nextNote.path || note.external !== nextNote.external
      ),
    ].slice(0, 8);
    writeRecentNotes(next);
  }, []);

  const removeRecentForNode = React.useCallback((node: TreeNode) => {
    const current = getRecentNotesSnapshot();
    const next = current.filter(
      (note) => note.external || !nodeContainsPath(node, note.path)
    );
    writeRecentNotes(next);
  }, []);

  const removeRecentNote = React.useCallback((target: RecentNote) => {
    const current = getRecentNotesSnapshot();
    const next = current.filter(
      (note) =>
        note.path !== target.path || note.external !== target.external
    );
    writeRecentNotes(next);
  }, []);

  const folderColorForPath = React.useCallback(
    (path: string) => folderColors[path] ?? fallbackFolderColor(path),
    [folderColors]
  );

  const setFolderColor = React.useCallback(
    (path: string, color: FolderColorKey) => {
      const next = { ...getFolderColorsSnapshot(), [path]: color };
      writeFolderColors(next);
    },
    []
  );

  const refreshTree = React.useCallback(async () => {
    const nextTree = await typesetApi.listTree();
    setTree(nextTree);
    return nextTree;
  }, []);

  const resetEditorCommandUi = React.useCallback(() => {
    setEditorHistory(EMPTY_EDITOR_HISTORY);
    setLastEditorCommand(null);
    setEditorCommandDockClosed(false);
  }, []);

  const openNote = React.useCallback(async (path: string) => {
    const document = await typesetApi.readNote(path);
    resetEditorCommandUi();
    setSelected(document);
    setContent(document.content);
    setSavedContent(document.content);
    setActiveSurface("document");
    rememberRecent(document);
  }, [rememberRecent, resetEditorCommandUi]);

  const openExternal = React.useCallback(async (path: string) => {
    const document = await typesetApi.openExternalNote(path);
    resetEditorCommandUi();
    setSelected(document);
    setContent(document.content);
    setSavedContent(document.content);
    setActiveSurface("document");
    rememberRecent(document);
    toast.info(`Opened ${document.name}`);
  }, [rememberRecent, resetEditorCommandUi]);

  const openRecent = React.useCallback(
    async (note: RecentNote) => {
      try {
        if (note.external) {
          await openExternal(note.path);
          return;
        }

        await openNote(note.path);
      } catch (error) {
        removeRecentNote(note);
        if (note.external) {
          toast.error("Recent external file is no longer available");
          return;
        }

        const nextTree = await refreshTree();
        const movedCandidates = findNotesByName(nextTree, note.name).filter(
          (candidate) => candidate.path !== note.path
        );
        if (movedCandidates.length === 1) {
          await openNote(movedCandidates[0].path);
          toast.info("Recent note moved. Opened its new location.");
          return;
        }

        toast.error(
          error instanceof Error ? error.message : "Recent note was not found"
        );
      }
    },
    [openExternal, openNote, refreshTree, removeRecentNote]
  );

  const checkForAppUpdate = React.useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      setUpdateState((current) => ({
        ...current,
        status: "checking",
        error: undefined,
      }));

      try {
        const result = await checkForUpdate();
        pendingUpdateRef.current = result.update;
        if (result.unsupported) {
          setUpdateState({
            status: "unsupported",
            currentVersion: result.currentVersion,
            downloadedBytes: 0,
          });
          return;
        }

        if (result.update) {
          setUpdateState({
            status: "available",
            currentVersion: result.currentVersion,
            latestVersion: result.latestVersion,
            body: result.body,
            date: result.date,
            downloadedBytes: 0,
          });
          if (!updateToastShownRef.current) {
            toast.info(`Typeset v${result.latestVersion} is available`);
            updateToastShownRef.current = true;
          }
          return;
        }

        setUpdateState({
          status: "up-to-date",
          currentVersion: result.currentVersion,
          downloadedBytes: 0,
        });
        if (!silent) {
          toast.success("Typeset is up to date");
        }
      } catch (error) {
        pendingUpdateRef.current = null;
        const message = error instanceof Error ? error.message : String(error);
        setUpdateState((current) => ({
          ...current,
          status: "error",
          error: message,
        }));
        if (!silent) {
          toast.error(message);
        }
      }
    },
    []
  );

  const installPendingUpdate = React.useCallback(async () => {
    const update = pendingUpdateRef.current;
    if (!update || updateState.status === "downloading" || updateState.status === "installing") {
      return;
    }

    setUpdateState((current) => ({
      ...current,
      status: "downloading",
      error: undefined,
      downloadedBytes: 0,
      contentLength: undefined,
      percent: undefined,
    }));

    try {
      await downloadAndInstallUpdate(update, (progress) => {
        setUpdateState((current) => ({
          ...current,
          downloadedBytes: progress.downloadedBytes,
          contentLength: progress.contentLength,
          percent: progress.percent,
        }));
      });
      setUpdateState((current) => ({ ...current, status: "installing" }));
      toast.info("Update installed. Restarting Typeset.");
      await relaunchOrExitAfterUpdate();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setUpdateState((current) => ({
        ...current,
        status: "error",
        error: message,
      }));
      toast.error(message);
    }
  }, [updateState.status]);

  React.useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const workspace = await typesetApi.initWorkspace();
        if (cancelled) {
          return;
        }
        setWorkspaceRoot(workspace.rootPath);
        setTree(workspace.tree);
        void getCurrentAppVersion().then((currentVersion) => {
          if (!cancelled) {
            setUpdateState((current) => ({ ...current, currentVersion }));
          }
        });
        void checkForAppUpdate({ silent: true });

        const startupFiles = await typesetApi.takeStartupFiles();
        if (startupFiles[0]) {
          await openExternal(startupFiles[0]);
        } else {
          const note = firstNote(workspace.tree);
          if (note) {
            await openNote(note.path);
          }
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, [checkForAppUpdate, openExternal, openNote]);

  React.useEffect(() => {
    if (!hasTauriRuntime()) {
      return;
    }
    let cleanup: (() => void) | undefined;
    try {
      listen<string[]>("typeset://external-open", (event) => {
        const [path] = event.payload;
        if (path) {
          openExternal(path);
        }
      })
        .then((unlisten) => {
          cleanup = unlisten;
        })
        .catch(() => {});
    } catch {
      return;
    }
    return () => cleanup?.();
  }, [openExternal]);

  async function runMutation(action: () => Promise<void>, success: string) {
    setBusy(true);
    try {
      await action();
      await refreshTree();
      toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  const openSettings = React.useCallback(async () => {
    setSettingsOpen(true);
    setWorkspaceLocation(workspaceRoot);
    try {
      const settings = await typesetApi.getWorkspaceSettings();
      setWorkspaceSettings(settings);
      setWorkspaceLocation(settings.rootPath);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }, [workspaceRoot]);

  async function submitWorkspaceSettings() {
    const location = workspaceLocation.trim();
    if (!location) {
      toast.error("Workspace location cannot be empty");
      return;
    }

    setBusy(true);
    try {
      const workspace = await typesetApi.setWorkspaceLocation(location);
      setWorkspaceRoot(workspace.rootPath);
      setTree(workspace.tree);
      resetEditorCommandUi();
      setSelected(null);
      setContent("");
      setSavedContent("");
      setActiveSurface("overview");
      writeRecentNotes(getRecentNotesSnapshot().filter((note) => note.external));

      const settings = await typesetApi.getWorkspaceSettings();
      setWorkspaceSettings(settings);
      setWorkspaceLocation(settings.rootPath);
      setSettingsOpen(false);
      toast.success("Workspace location updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  const handleSave = React.useCallback(async () => {
    if (!selected || selected.external || !dirty || busy) {
      return;
    }

    setBusy(true);
    try {
      const document = await typesetApi.saveNote(selected.path, content);
      setSelected(document);
      setContent(document.content);
      setSavedContent(document.content);
      await refreshTree();
      toast.success("Saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }, [busy, content, dirty, refreshTree, selected]);

  const updateEditorHistory = React.useCallback((next: EditorHistoryState) => {
    setEditorHistory((current) =>
      current.canUndo === next.canUndo && current.canRedo === next.canRedo
        ? current
        : next
    );
  }, []);

  const registerEditorCommands = React.useCallback(
    (controller: EditorCommandController | null) => {
      const nextController = controller ?? EMPTY_EDITOR_COMMANDS;
      editorCommandsRef.current = nextController;
      updateEditorHistory({
        canUndo: nextController.canUndo(),
        canRedo: nextController.canRedo(),
      });
    },
    [updateEditorHistory]
  );

  const handleEditorCommandAction = React.useCallback(
    (action: EditorCommandAction, history: EditorHistoryState) => {
      updateEditorHistory(history);
      setEditorCommandDockClosed(false);
      setLastEditorCommand(action);

      if (action === "save") {
        void handleSave();
      }
    },
    [handleSave, updateEditorHistory]
  );

  const runEditorUndo = React.useCallback(() => {
    editorCommandsRef.current.undo();
  }, []);

  const runEditorRedo = React.useCallback(() => {
    editorCommandsRef.current.redo();
  }, []);

  async function handleImportExternal() {
    if (!selected?.external) {
      return;
    }
    await runMutation(async () => {
      const node = await typesetApi.importExternalNote(selected.path, "", selected.name);
      await openNote(node.path);
    }, "Imported");
  }

  function openCreate(kind: CreateKind, node?: TreeNode) {
    setCreateName("");
    if (kind === "sub-note" && node?.kind === "note") {
      setCreateDialog({ open: true, kind, parent: parentPath(node.path), parentNote: node.path });
      return;
    }
    setCreateDialog({
      open: true,
      kind,
      parent: node?.kind === "folder" ? node.path : node ? parentPath(node.path) : "",
    });
  }

  async function submitCreate() {
    if (!createDialog.open || !createName.trim()) {
      return;
    }
    await runMutation(async () => {
      let node: TreeNode;
      if (createDialog.kind === "folder") {
        node = await typesetApi.createFolder(createDialog.parent, createName);
      } else if (createDialog.kind === "sub-note") {
        node = await typesetApi.createSubNote(createDialog.parentNote ?? "", createName);
      } else {
        node = await typesetApi.createNote(createDialog.parent, createName);
      }
      if (node.kind === "note") {
        await openNote(node.path);
      }
      setCreateDialog({ open: false });
    }, "Created");
  }

  async function submitRename() {
    if (!renameDialog.open || !renameDialog.value.trim()) {
      return;
    }
    const node = renameDialog.node;
    const previousPath = node.path;
    await runMutation(async () => {
      await typesetApi.renameNode(previousPath, renameDialog.value);
      removeRecentForNode(node);
      if (selected && nodeContainsPath(node, selected.path)) {
        resetEditorCommandUi();
        setSelected(null);
        setContent("");
        setSavedContent("");
      }
      setRenameDialog({ open: false });
    }, "Renamed");
  }

  async function submitMove() {
    if (!moveDialog.open) {
      return;
    }
    const node = moveDialog.node;
    await runMutation(async () => {
      await typesetApi.moveNode(node.path, moveDialog.destination.trim());
      removeRecentForNode(node);
      if (selected && nodeContainsPath(node, selected.path)) {
        resetEditorCommandUi();
        setSelected(null);
        setContent("");
        setSavedContent("");
      }
      setMoveDialog({ open: false });
    }, "Moved");
  }

  async function submitDelete() {
    if (!deleteDialog.open) {
      return;
    }
    const node = deleteDialog.node;
    await runMutation(async () => {
      await typesetApi.deleteNode(node.path);
      removeRecentForNode(node);
      if (selected && nodeContainsPath(node, selected.path)) {
        resetEditorCommandUi();
        setSelected(null);
        setContent("");
        setSavedContent("");
      }
      setDeleteDialog({ open: false });
    }, "Deleted");
  }

  function handleDragStart(event: DragStartEvent) {
    const activePath = event.active.data.current?.path as string | undefined;
    setDraggingNode(activePath ? findNodeByPath(tree, activePath) ?? null : null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    try {
      const activePath = event.active.data.current?.path as string | undefined;
      const overPath = event.over?.data.current?.path as string | undefined;
      if (!activePath || overPath === undefined || activePath === overPath) {
        return;
      }
      const movedNode = findNodeByPath(tree, activePath);
      if (!movedNode || dropWouldMoveNodeIntoItself(movedNode, overPath)) {
        toast.error("That item cannot be moved there");
        return;
      }
      await runMutation(async () => {
        await typesetApi.moveNode(activePath, overPath);
        removeRecentForNode(movedNode);
        if (selected && nodeContainsPath(movedNode, selected.path)) {
          resetEditorCommandUi();
          setSelected(null);
          setContent("");
          setSavedContent("");
        }
      }, "Moved");
    } finally {
      setDraggingNode(null);
    }
  }

  const editorDockVisible =
    activeSurface === "document" &&
    mode !== "preview" &&
    Boolean(selected) &&
    !editorCommandDockClosed &&
    (dirty ||
      editorHistory.canUndo ||
      editorHistory.canRedo ||
      lastEditorCommand !== null);

  return (
    <SidebarProvider
      open={sidebarOpen}
      onOpenChange={setSidebarOpen}
      className="h-dvh max-h-dvh min-h-0 overflow-hidden overscroll-none bg-background text-foreground"
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDraggingNode(null)}
      >
        <TypesetSidebar
          query={query}
          onQueryChange={setQuery}
          loading={loading}
          filteredTree={filteredTree}
          recentNotes={recentNotes}
          selectedPath={selected?.external ? undefined : selected?.path}
          selectedRecentPath={selected?.path}
          selectedRecentExternal={selected?.external ?? false}
          activeSurface={activeSurface}
          folderColorForPath={folderColorForPath}
          onFolderColor={setFolderColor}
          updateAvailable={updateState.status === "available"}
          onOverview={() => setActiveSurface("overview")}
          onOpenUpdate={() => setUpdateDialogOpen(true)}
          onOpenSettings={openSettings}
          onOpenRecent={openRecent}
          onOpenNote={openNote}
          onCreate={openCreate}
          onRename={(target) =>
            setRenameDialog({
              open: true,
              node: target,
              value: target.name,
            })
          }
          onMove={(target) =>
            setMoveDialog({
              open: true,
              node: target,
              destination: parentPath(target.path),
            })
          }
          onDelete={(target) => setDeleteDialog({ open: true, node: target })}
        />
        <SidebarInset className="relative h-dvh max-h-dvh min-w-0 overflow-hidden overscroll-none md:m-0 md:rounded-xl md:shadow-none md:peer-data-[variant=inset]:m-0 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-none md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-0">
          <Titlebar
            activeSurface={activeSurface}
            selected={selected}
            dirty={dirty}
            busy={busy}
            mode={mode}
            onModeChange={setMode}
            onSave={handleSave}
            onImport={handleImportExternal}
          />
          <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <section className="min-h-0 flex-1 overflow-hidden p-4 pt-0">
                {activeSurface === "overview" ? (
                  <div className="h-full min-h-0 overflow-hidden">
                    <WorkspaceOverview
                      tree={tree}
                      workspaceRoot={workspaceRoot}
                      recentNotes={recentNotes.slice(0, 4)}
                      folderColorForPath={folderColorForPath}
                      onOpenNote={openNote}
                      onOpenRecent={openRecent}
                      onCreateNote={() => openCreate("note")}
                    />
                  </div>
                ) : (
                  <div className="flex h-full min-h-0 flex-col overflow-hidden">
                    <div className="min-h-0 flex-1">
                      {selected ? (
                        <EditorSurface
                          mode={mode}
                          selected={selected}
                          content={content}
                          onChange={setContent}
                          onOpenInternalLink={openNote}
                          onEditorCommandController={registerEditorCommands}
                          onEditorCommandAction={handleEditorCommandAction}
                          onEditorHistoryChange={updateEditorHistory}
                        />
                      ) : (
                        <EmptyDocument onCreate={() => openCreate("note")} />
                      )}
                    </div>
                  </div>
                )}
              </section>
            </main>
          <EditorCommandDock
            visible={editorDockVisible}
            canUndo={editorHistory.canUndo}
            canRedo={editorHistory.canRedo}
            dirty={dirty}
            busy={busy}
            lastAction={lastEditorCommand}
            saveDisabled={!selected || selected.external}
            onUndo={runEditorUndo}
            onRedo={runEditorRedo}
            onSave={handleSave}
            onClose={() => setEditorCommandDockClosed(true)}
          />
        </SidebarInset>
        <DragOverlay dropAnimation={null}>
          {draggingNode ? (
            <TreeDragOverlay
              node={draggingNode}
              folderColor={folderColorForPath(draggingNode.path)}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      <CreateDialog
        state={createDialog}
        name={createName}
        onNameChange={setCreateName}
        onOpenChange={(open) => !open && setCreateDialog({ open: false })}
        onSubmit={submitCreate}
      />
      <RenameDialog
        state={renameDialog}
        onChange={(value) =>
          setRenameDialog((current) =>
            current.open ? { ...current, value } : current
          )
        }
        onOpenChange={(open) => !open && setRenameDialog({ open: false })}
        onSubmit={submitRename}
      />
      <MoveDialog
        state={moveDialog}
        workspaceRoot={workspaceRoot}
        onChange={(destination) =>
          setMoveDialog((current) =>
            current.open ? { ...current, destination } : current
          )
        }
        onOpenChange={(open) => !open && setMoveDialog({ open: false })}
        onSubmit={submitMove}
      />
      <WorkspaceSettingsDialog
        open={settingsOpen}
        busy={busy}
        settings={workspaceSettings}
        location={workspaceLocation}
        onLocationChange={setWorkspaceLocation}
        onOpenChange={setSettingsOpen}
        onSubmit={submitWorkspaceSettings}
        updateState={updateState}
        onCheckUpdate={() => checkForAppUpdate()}
        onOpenUpdate={() => setUpdateDialogOpen(true)}
      />
      <UpdateDialog
        open={updateDialogOpen}
        state={updateState}
        onOpenChange={setUpdateDialogOpen}
        onCheckUpdate={() => checkForAppUpdate()}
        onInstall={installPendingUpdate}
      />
      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => !open && setDeleteDialog({ open: false })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteDialog.open ? deleteDialog.node.name : "item"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Notes with child folders will remove their sub-files too.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={submitDelete}>
              <Trash2Icon data-icon="inline-start" />
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}

function TypesetSidebar({
  query,
  onQueryChange,
  loading,
  filteredTree,
  recentNotes,
  selectedPath,
  selectedRecentPath,
  selectedRecentExternal,
  activeSurface,
  folderColorForPath,
  onFolderColor,
  updateAvailable,
  onOverview,
  onOpenUpdate,
  onOpenSettings,
  onOpenRecent,
  onOpenNote,
  onCreate,
  onRename,
  onMove,
  onDelete,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  loading: boolean;
  filteredTree: TreeNode[];
  recentNotes: RecentNote[];
  selectedPath?: string;
  selectedRecentPath?: string;
  selectedRecentExternal: boolean;
  activeSurface: ActiveSurface;
  folderColorForPath: (path: string) => FolderColorKey;
  onFolderColor: (path: string, color: FolderColorKey) => void;
  updateAvailable: boolean;
  onOverview: () => void;
  onOpenUpdate: () => void;
  onOpenSettings: () => void;
  onOpenRecent: (note: RecentNote) => void;
  onOpenNote: (path: string) => void;
  onCreate: (kind: CreateKind, node?: TreeNode) => void;
  onRename: (node: TreeNode) => void;
  onMove: (node: TreeNode) => void;
  onDelete: (node: TreeNode) => void;
}) {
  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="relative min-w-0 flex-1">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <SidebarInput
              className="pl-8"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search notes"
            />
          </div>
          {updateAvailable && (
            <Button
              aria-label="Update available"
              variant="ghost"
              size="icon-sm"
              onClick={onOpenUpdate}
            >
              <DownloadIcon />
            </Button>
          )}
          <Button
            aria-label="Settings"
            variant="ghost"
            size="icon-sm"
            onClick={onOpenSettings}
          >
            <SettingsIcon />
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent className="overflow-hidden">
        <SidebarGroup className="shrink-0">
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeSurface === "overview"}
                  tooltip="Overview"
                  onClick={onOverview}
                >
                  <HardDriveIcon />
                  <span>Overview</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="shrink-0">
          <SidebarGroupLabel>Recent</SidebarGroupLabel>
          <SidebarGroupContent>
            {recentNotes.length ? (
              <SidebarMenu>
                {recentNotes.slice(0, 4).map((note) => (
                  <SidebarMenuItem
                    key={`${note.external ? "external" : "managed"}:${note.path}`}
                  >
                    <SidebarMenuButton
                      isActive={
                        activeSurface === "document" &&
                        selectedRecentPath === note.path &&
                        selectedRecentExternal === note.external
                      }
                      tooltip={note.name}
                      onClick={() => onOpenRecent(note)}
                    >
                      <ClockIcon />
                      <span>{noteTitle(note.name)}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            ) : (
              <div className="px-2 py-2 text-xs text-muted-foreground">
                No recent notes
              </div>
            )}
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="min-h-0 flex-1 overflow-hidden">
          <SidebarGroupLabel className="justify-between gap-2">
            <span>Folders</span>
            <span className="flex items-center gap-1">
              <Button
                aria-label="New note"
                variant="ghost"
                size="icon-sm"
                onClick={() => onCreate("note")}
              >
                <FilePlusIcon />
              </Button>
              <Button
                aria-label="New folder"
                variant="ghost"
                size="icon-sm"
                onClick={() => onCreate("folder")}
              >
                <FolderPlusIcon />
              </Button>
            </span>
          </SidebarGroupLabel>
          <SidebarGroupContent className="min-h-0 flex-1 overflow-hidden">
            <RootDropArea>
              {loading ? (
                <LoadingTree />
              ) : filteredTree.length ? (
                <SidebarMenu>
                  {filteredTree.map((node) => (
                    <TreeItem
                      key={node.id}
                      node={node}
                      selectedPath={selectedPath}
                      folderColorForPath={folderColorForPath}
                      onFolderColor={onFolderColor}
                      onOpen={onOpenNote}
                      onCreate={onCreate}
                      onRename={onRename}
                      onMove={onMove}
                      onDelete={onDelete}
                    />
                  ))}
                </SidebarMenu>
              ) : (
                <div className="px-2 py-8 text-center text-sm text-muted-foreground">
                  No notes yet
                </div>
              )}
            </RootDropArea>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}

function RootDropArea({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: "drop:root",
    data: { path: "" },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "no-scrollbar h-full min-h-40 overflow-y-auto overflow-x-hidden rounded-md transition-colors",
        isOver && "bg-sidebar-accent"
      )}
    >
      {children}
    </div>
  );
}

function TreeItem({
  node,
  selectedPath,
  folderColorForPath,
  onFolderColor,
  onOpen,
  onCreate,
  onRename,
  onMove,
  onDelete,
}: {
  node: TreeNode;
  selectedPath?: string;
  folderColorForPath: (path: string) => FolderColorKey;
  onFolderColor: (path: string, color: FolderColorKey) => void;
  onOpen: (path: string) => void;
  onCreate: (kind: CreateKind, node: TreeNode) => void;
  onRename: (node: TreeNode) => void;
  onMove: (node: TreeNode) => void;
  onDelete: (node: TreeNode) => void;
}) {
  const [open, setOpen] = React.useState(true);
  const isFolder = node.kind === "folder";
  const isSelected = selectedPath === node.path;
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef: setDragNodeRef,
  } = useDraggable({
    id: node.id,
    data: { path: node.path, kind: node.kind },
  });
  const droppable = useDroppable({
    id: `drop:${node.path}`,
    disabled: !isFolder,
    data: { path: node.path },
  });
  const setRowNodeRef = React.useCallback(
    (element: HTMLDivElement | null) => {
      setDragNodeRef(element);
      if (isFolder) {
        droppable.setNodeRef(element);
      }
    },
    [droppable, isFolder, setDragNodeRef]
  );
  const folderColor = folderColorForPath(node.path);

  return (
    <SidebarMenuItem className="min-w-0">
      <div className="min-w-0 overflow-hidden">
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            ref={setRowNodeRef}
            className={cn(
              "relative min-w-0 rounded-md",
              isDragging && "bg-sidebar-accent opacity-50",
              droppable.isOver && "bg-sidebar-accent"
            )}
          >
            <SidebarMenuButton
              className="min-w-0"
              isActive={isSelected}
              tooltip={node.name}
              onClick={() => (isFolder ? setOpen((value) => !value) : onOpen(node.path))}
            >
              <span
                ref={setActivatorNodeRef}
                className={cn(
                  "cursor-grab touch-none select-none text-muted-foreground",
                  isDragging && "cursor-grabbing"
                )}
                {...listeners}
                {...attributes}
              >
                <GripVerticalIcon />
              </span>
              {isFolder ? (
                open ? (
                  <ChevronDownIcon />
                ) : (
                  <ChevronRightIcon />
                )
              ) : (
                <FileTextIcon />
              )}
              {isFolder ? (
                <FolderBadge
                  text={node.name}
                  color={folderColor}
                  className="min-w-0 flex-1"
                  folderSize={{ width: 20, height: 15 }}
                  textClassName="text-sm"
                />
              ) : (
                <span className="min-w-0 flex-1 truncate">
                  {noteTitle(node.name)}
                </span>
              )}
            </SidebarMenuButton>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {node.kind === "note" && (
            <ContextMenuItem onClick={() => onCreate("sub-note", node)}>
              <FileTextIcon />
              New sub-note
            </ContextMenuItem>
          )}
          {node.kind === "folder" && (
            <>
              <ContextMenuItem onClick={() => onCreate("note", node)}>
                <FileTextIcon />
                New note
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onCreate("folder", node)}>
                <FolderPlusIcon />
                New folder
              </ContextMenuItem>
              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  <PaletteIcon />
                  Folder color
                </ContextMenuSubTrigger>
                <ContextMenuSubContent>
                  {FOLDER_COLOR_OPTIONS.map((option) => (
                    <ContextMenuItem
                      key={option.key}
                      onClick={() => onFolderColor(node.path, option.key)}
                    >
                      <span
                        className={cn(
                          "size-2.5 rounded-full",
                          option.swatchClassName
                        )}
                      />
                      {option.label}
                    </ContextMenuItem>
                  ))}
                </ContextMenuSubContent>
              </ContextMenuSub>
            </>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onRename(node)}>Rename</ContextMenuItem>
          <ContextMenuItem onClick={() => onMove(node)}>Move</ContextMenuItem>
          <ContextMenuItem variant="destructive" onClick={() => onDelete(node)}>
            <Trash2Icon />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      {open && node.children.length > 0 && (
        <SidebarMenu className="ml-4 w-auto border-l border-sidebar-border pl-2">
          {node.children.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              selectedPath={selectedPath}
              folderColorForPath={folderColorForPath}
              onFolderColor={onFolderColor}
              onOpen={onOpen}
              onCreate={onCreate}
              onRename={onRename}
              onMove={onMove}
              onDelete={onDelete}
            />
          ))}
        </SidebarMenu>
      )}
      </div>
    </SidebarMenuItem>
  );
}

function TreeDragOverlay({
  node,
  folderColor,
}: {
  node: TreeNode;
  folderColor: FolderColorKey;
}) {
  const isFolder = node.kind === "folder";

  return (
    <div className="flex h-8 w-56 max-w-[calc(var(--sidebar-width)-1rem)] items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent px-2 text-sm font-medium text-sidebar-accent-foreground shadow-xl shadow-black/30">
      <GripVerticalIcon className="size-4 shrink-0 text-muted-foreground" />
      {isFolder ? (
        <FolderBadge
          text={node.name}
          color={folderColor}
          className="min-w-0 flex-1"
          folderSize={{ width: 20, height: 15 }}
          textClassName="text-sm"
        />
      ) : (
        <>
          <FileTextIcon className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{noteTitle(node.name)}</span>
        </>
      )}
    </div>
  );
}

function Titlebar({
  activeSurface,
  selected,
  dirty,
  busy,
  mode,
  onModeChange,
  onSave,
  onImport,
}: {
  activeSurface: ActiveSurface;
  selected: NoteDocument | null;
  dirty: boolean;
  busy: boolean;
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  onSave: () => void;
  onImport: () => void;
}) {
  const pageLabel =
    activeSurface === "overview"
      ? "Overview"
      : selected
        ? noteTitle(selected.name)
        : "Editor";

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background select-none">
      <div className="flex min-w-0 flex-1 items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-vertical:h-4 data-vertical:self-auto"
        />
        <Breadcrumb className="min-w-0">
          <BreadcrumbList className="flex-nowrap">
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbPage>Typeset</BreadcrumbPage>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem className="min-w-0">
              <BreadcrumbPage className="truncate">{pageLabel}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="flex h-full shrink-0 items-center gap-2 px-4">
        {activeSurface === "document" && (
          <Tabs
            value={mode}
            onValueChange={(value) => onModeChange(value as ViewMode)}
          >
            <TabsList>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="source">Source</TabsTrigger>
              <TabsTrigger value="split">
                <SplitSquareHorizontalIcon data-icon="inline-start" />
                Split
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        {activeSurface === "document" && selected?.external ? (
          <Button variant="outline" size="sm" onClick={onImport} disabled={busy}>
            <ImportIcon data-icon="inline-start" />
            Import
          </Button>
        ) : activeSurface === "document" ? (
          <Button size="sm" onClick={onSave} disabled={!dirty || busy || !selected}>
            <SaveIcon data-icon="inline-start" />
            Save
          </Button>
        ) : null}
        {dirty && <Badge variant="outline">Unsaved</Badge>}
        {busy && <Badge variant="secondary">Working</Badge>}
      </div>
    </header>
  );
}

function EditorCommandDock({
  visible,
  canUndo,
  canRedo,
  dirty,
  busy,
  lastAction,
  saveDisabled,
  onUndo,
  onRedo,
  onSave,
  onClose,
}: {
  visible: boolean;
  canUndo: boolean;
  canRedo: boolean;
  dirty: boolean;
  busy: boolean;
  lastAction: EditorCommandAction | null;
  saveDisabled: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onClose: () => void;
}) {
  if (!visible) {
    return null;
  }

  const status =
    lastAction === "undo"
      ? "Undone"
      : lastAction === "redo"
        ? "Redone"
        : lastAction === "save"
          ? "Saved"
          : dirty
            ? "Editing"
            : "Ready";

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-5 z-30 flex justify-center px-4">
      <div className="pointer-events-auto flex max-w-[calc(100vw-2rem)] items-center gap-1 rounded-full border border-border bg-background/95 p-1 shadow-2xl shadow-black/30 backdrop-blur">
        <Badge variant="secondary" className="hidden rounded-full px-3 sm:inline-flex">
          {status}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo"
        >
          <Undo2Icon data-icon="inline-start" />
          Undo
        </Button>
        {canRedo && (
          <Button variant="ghost" size="sm" onClick={onRedo} title="Redo">
            <Redo2Icon data-icon="inline-start" />
            Redo
          </Button>
        )}
        <Button
          variant={dirty ? "default" : "ghost"}
          size="sm"
          onClick={onSave}
          disabled={saveDisabled || !dirty || busy}
          title="Save"
        >
          <SaveIcon data-icon="inline-start" />
          Save
        </Button>
        <Separator
          orientation="vertical"
          className="mx-1 data-vertical:h-5 data-vertical:self-auto"
        />
        <Button
          aria-label="Close editor command dock"
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          title="Close"
        >
          <XIcon />
        </Button>
      </div>
    </div>
  );
}

function EditorSurface({
  mode,
  selected,
  content,
  onChange,
  onOpenInternalLink,
  onEditorCommandController,
  onEditorCommandAction,
  onEditorHistoryChange,
}: {
  mode: ViewMode;
  selected: NoteDocument | null;
  content: string;
  onChange: (content: string) => void;
  onOpenInternalLink: (path: string) => void;
  onEditorCommandController: (controller: EditorCommandController | null) => void;
  onEditorCommandAction: (
    action: EditorCommandAction,
    history: EditorHistoryState
  ) => void;
  onEditorHistoryChange: (history: EditorHistoryState) => void;
}) {
  const previewContent = React.useDeferredValue(content);
  const documentKey = selected?.path ?? "editor";
  const splitPreviewRef = React.useRef<HTMLDivElement | null>(null);
  const splitEditorScrollControllerRef = React.useRef<EditorScrollController>({
    scrollToLine: () => {},
    scrollToRatio: () => {},
  });
  const scrollSyncOriginRef = React.useRef<"editor" | "preview" | null>(null);
  const scrollSyncResetFrameRef = React.useRef<number | null>(null);
  const previewSyncFrameRef = React.useRef<number | null>(null);
  const pendingPreviewSyncRef = React.useRef<ScrollSyncTarget | null>(null);
  const editorSyncFrameRef = React.useRef<number | null>(null);
  const pendingEditorSyncRef = React.useRef<ScrollSyncTarget | null>(null);
  const previewAnchorsRef = React.useRef<PreviewAnchor[]>([]);
  const previewAnchorRefreshFrameRef = React.useRef<number | null>(null);

  const markScrollSyncOrigin = React.useCallback(
    (origin: "editor" | "preview") => {
      scrollSyncOriginRef.current = origin;
      if (scrollSyncResetFrameRef.current !== null) {
        cancelAnimationFrame(scrollSyncResetFrameRef.current);
      }

      scrollSyncResetFrameRef.current = requestAnimationFrame(() => {
        scrollSyncResetFrameRef.current = requestAnimationFrame(() => {
          scrollSyncOriginRef.current = null;
          scrollSyncResetFrameRef.current = null;
        });
      });
    },
    [],
  );

  const refreshPreviewAnchors = React.useCallback(() => {
    if (previewAnchorRefreshFrameRef.current !== null) {
      return;
    }

    previewAnchorRefreshFrameRef.current = requestAnimationFrame(() => {
      previewAnchorRefreshFrameRef.current = null;
      const preview = splitPreviewRef.current;
      previewAnchorsRef.current = preview ? collectPreviewAnchors(preview) : [];
    });
  }, []);

  React.useLayoutEffect(() => {
    refreshPreviewAnchors();
  }, [mode, previewContent, refreshPreviewAnchors]);

  React.useEffect(() => {
    const preview = splitPreviewRef.current;
    if (!preview || mode !== "split") {
      return;
    }

    const observer = new ResizeObserver(refreshPreviewAnchors);
    observer.observe(preview);
    const article = preview.querySelector(".typeset-preview");
    if (article instanceof HTMLElement) {
      observer.observe(article);
    }

    return () => observer.disconnect();
  }, [mode, previewContent, refreshPreviewAnchors]);

  React.useEffect(
    () => () => {
      if (scrollSyncResetFrameRef.current !== null) {
        cancelAnimationFrame(scrollSyncResetFrameRef.current);
      }
      if (previewSyncFrameRef.current !== null) {
        cancelAnimationFrame(previewSyncFrameRef.current);
      }
      if (editorSyncFrameRef.current !== null) {
        cancelAnimationFrame(editorSyncFrameRef.current);
      }
      if (previewAnchorRefreshFrameRef.current !== null) {
        cancelAnimationFrame(previewAnchorRefreshFrameRef.current);
      }
    },
    [],
  );

  React.useEffect(() => {
    if (mode === "preview") {
      onEditorCommandController(null);
      onEditorHistoryChange(EMPTY_EDITOR_HISTORY);
    }
  }, [mode, onEditorCommandController, onEditorHistoryChange]);

  const syncSplitPreviewScroll = React.useCallback(
    (target: ScrollSyncTarget) => {
      if (scrollSyncOriginRef.current === "preview") {
        return;
      }

      pendingPreviewSyncRef.current = target;
      if (previewSyncFrameRef.current !== null) {
        return;
      }

      previewSyncFrameRef.current = requestAnimationFrame(() => {
        previewSyncFrameRef.current = null;
        const pendingTarget = pendingPreviewSyncRef.current;
        pendingPreviewSyncRef.current = null;

        const preview = splitPreviewRef.current;
        if (!preview || !pendingTarget) {
          return;
        }

        const nextTop =
          scrollTopForPreviewSourceLine(
            preview,
            previewAnchorsRef.current,
            pendingTarget.line,
          ) ??
          scrollTopForRatio(preview, pendingTarget.ratio);
        if (nextTop === null) {
          return;
        }

        markScrollSyncOrigin("editor");
        preview.scrollTop = nextTop;
      });
    },
    [markScrollSyncOrigin],
  );

  const scheduleSplitEditorScroll = React.useCallback(
    (target: ScrollSyncTarget) => {
      pendingEditorSyncRef.current = target;
      if (editorSyncFrameRef.current !== null) {
        return;
      }

      editorSyncFrameRef.current = requestAnimationFrame(() => {
        editorSyncFrameRef.current = null;
        const pendingTarget = pendingEditorSyncRef.current;
        pendingEditorSyncRef.current = null;
        if (!pendingTarget) {
          return;
        }

        markScrollSyncOrigin("preview");
        if (pendingTarget.line > 0) {
          splitEditorScrollControllerRef.current.scrollToLine(pendingTarget.line);
        } else {
          splitEditorScrollControllerRef.current.scrollToRatio(
            pendingTarget.ratio,
          );
        }
      });
    },
    [markScrollSyncOrigin],
  );

  const syncSplitEditorScroll = React.useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      if (scrollSyncOriginRef.current === "editor") {
        return;
      }

      const preview = event.currentTarget;
      const line = sourceLineFromPreviewScroll(
        preview,
        previewAnchorsRef.current,
      );
      const ratio = scrollRatio(preview);

      scheduleSplitEditorScroll({ line: line ?? 0, ratio });
    },
    [scheduleSplitEditorScroll],
  );

  const registerSplitEditorScroll = React.useCallback(
    (controller: EditorScrollController) => {
      splitEditorScrollControllerRef.current = controller;
    },
    [],
  );

  if (mode === "preview") {
    return (
      <ScrollArea className="h-full">
        <div className="mx-auto max-w-4xl px-8 py-8">
          <MarkdownPreview
            content={previewContent}
            basePath={selected?.external ? undefined : selected?.path}
            onContentChange={onChange}
            onOpenInternalLink={onOpenInternalLink}
          />
        </div>
      </ScrollArea>
    );
  }

  if (mode === "source") {
    return (
      <MarkdownEditor
        documentKey={documentKey}
        content={content}
        onChange={onChange}
        onCommandController={onEditorCommandController}
        onCommandAction={onEditorCommandAction}
        onHistoryChange={onEditorHistoryChange}
      />
    );
  }

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full">
      <ResizablePanel defaultSize={48} minSize={28}>
        <MarkdownEditor
          documentKey={documentKey}
          content={content}
          onChange={onChange}
          onScrollChange={syncSplitPreviewScroll}
          onScrollController={registerSplitEditorScroll}
          onCommandController={onEditorCommandController}
          onCommandAction={onEditorCommandAction}
          onHistoryChange={onEditorHistoryChange}
        />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={52} minSize={28}>
        <div
          ref={splitPreviewRef}
          className="no-scrollbar h-full overflow-y-auto overflow-x-hidden"
          onScroll={syncSplitEditorScroll}
        >
          <div className="mx-auto max-w-4xl px-8 py-8">
            <MarkdownPreview
              content={previewContent}
              basePath={selected?.external ? undefined : selected?.path}
              onContentChange={onChange}
              onOpenInternalLink={onOpenInternalLink}
            />
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

function scrollRatio(element: HTMLElement) {
  const maxScroll = element.scrollHeight - element.clientHeight;
  return maxScroll > 0 ? element.scrollTop / maxScroll : 0;
}

function scrollTopForRatio(element: HTMLElement, ratio: number) {
  const maxScroll = element.scrollHeight - element.clientHeight;
  if (maxScroll <= 0) {
    return null;
  }

  return Math.min(1, Math.max(0, ratio)) * maxScroll;
}

function scrollTopForPreviewSourceLine(
  preview: HTMLElement,
  anchors: PreviewAnchor[],
  line: number,
) {
  if (!anchors.length) {
    return null;
  }

  const targetIndex = previewAnchorIndexForLine(anchors, line);
  const target = anchors[targetIndex];
  if (!target) {
    return null;
  }

  const nextTarget = anchors[targetIndex + 1];
  if (nextTarget && nextTarget.line > target.line) {
    const progress = Math.min(
      1,
      Math.max(0, (line - target.line) / (nextTarget.line - target.line)),
    );
    return clampScrollTop(
      preview,
      target.top + (nextTarget.top - target.top) * progress - 24,
    );
  }

  return clampScrollTop(preview, target.top - 24);
}

function sourceLineFromPreviewScroll(
  preview: HTMLElement,
  anchors: PreviewAnchor[],
) {
  if (!anchors.length) {
    return null;
  }

  const threshold = preview.scrollTop + 40;
  const target = anchors[previewAnchorIndexForTop(anchors, threshold)];
  return target?.line ?? null;
}

function previewAnchorIndexForLine(anchors: PreviewAnchor[], line: number) {
  let low = 0;
  let high = anchors.length - 1;
  let result = 0;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (anchors[middle].line <= line) {
      result = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return result;
}

function previewAnchorIndexForTop(anchors: PreviewAnchor[], top: number) {
  let low = 0;
  let high = anchors.length - 1;
  let result = 0;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (anchors[middle].top <= top) {
      result = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return result;
}

function collectPreviewAnchors(preview: HTMLElement): PreviewAnchor[] {
  const elements = Array.from(
    preview.querySelectorAll<HTMLElement>("[data-source-line]"),
  );
  const anchors: PreviewAnchor[] = [];
  let previousLine = 0;
  let previousTop = -1;

  for (const element of elements) {
    const line = sourceLineFromElement(element);
    if (line === null) {
      continue;
    }

    const top = elementOffsetTop(preview, element);
    if (line < previousLine || top < previousTop) {
      continue;
    }

    previousLine = line;
    previousTop = top;
    anchors.push({ line, top });
  }

  return anchors;
}

function sourceLineFromElement(element: HTMLElement) {
  const line = Number.parseInt(element.dataset.sourceLine ?? "", 10);
  return Number.isFinite(line) ? line : null;
}

function elementOffsetTop(container: HTMLElement, element: HTMLElement) {
  return (
    element.getBoundingClientRect().top -
    container.getBoundingClientRect().top +
    container.scrollTop
  );
}

function clampScrollTop(element: HTMLElement, scrollTop: number) {
  const maxScroll = Math.max(0, element.scrollHeight - element.clientHeight);
  return Math.min(maxScroll, Math.max(0, scrollTop));
}

function MarkdownEditor({
  documentKey,
  content,
  onChange,
  onScrollChange,
  onScrollController,
  onCommandController,
  onCommandAction,
  onHistoryChange,
}: {
  documentKey: string;
  content: string;
  onChange: (content: string) => void;
  onScrollChange?: (target: ScrollSyncTarget) => void;
  onScrollController?: (controller: EditorScrollController) => void;
  onCommandController?: (controller: EditorCommandController | null) => void;
  onCommandAction?: (
    action: EditorCommandAction,
    history: EditorHistoryState
  ) => void;
  onHistoryChange?: (history: EditorHistoryState) => void;
}) {
  const editorViewRef = React.useRef<EditorView | null>(null);

  const editorHistoryState = React.useCallback(
    (view: EditorView): EditorHistoryState => ({
      canUndo: undoDepth(view.state) > 0,
      canRedo: redoDepth(view.state) > 0,
    }),
    []
  );

  const publishHistoryState = React.useCallback(
    (view: EditorView, action?: EditorCommandAction) => {
      const history = editorHistoryState(view);
      onHistoryChange?.(history);
      if (action) {
        onCommandAction?.(action, history);
      }
    },
    [editorHistoryState, onCommandAction, onHistoryChange]
  );

  const runHistoryCommand = React.useCallback(
    (view: EditorView, action: "undo" | "redo") => {
      const canRun =
        action === "undo" ? undoDepth(view.state) > 0 : redoDepth(view.state) > 0;
      if (!canRun) {
        publishHistoryState(view);
        return false;
      }

      const ran = action === "undo" ? undo(view) : redo(view);
      if (ran) {
        view.focus();
        publishHistoryState(view, action);
      }
      return ran;
    },
    [publishHistoryState]
  );

  const scrollSyncExtension = React.useMemo(() => {
    if (!onScrollChange) {
      return null;
    }

    return EditorView.domEventHandlers({
      scroll(_event, view) {
        const scroller = view.scrollDOM;
        const block = view.lineBlockAtHeight(scroller.scrollTop + 8);
        onScrollChange({
          line: view.state.doc.lineAt(block.from).number,
          ratio: scrollRatio(scroller),
        });
      },
    });
  }, [onScrollChange]);

  const commandExtension = React.useMemo(
    () => [
      Prec.high(
        keymap.of([
          {
            key: "Mod-s",
            preventDefault: true,
            run(view) {
              publishHistoryState(view, "save");
              return true;
            },
          },
          {
            key: "Mod-z",
            preventDefault: true,
            run(view) {
              runHistoryCommand(view, "undo");
              return true;
            },
          },
          {
            key: "Mod-y",
            preventDefault: true,
            run(view) {
              runHistoryCommand(view, "redo");
              return true;
            },
          },
          {
            key: "Mod-Shift-z",
            preventDefault: true,
            run(view) {
              runHistoryCommand(view, "redo");
              return true;
            },
          },
        ])
      ),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          publishHistoryState(update.view);
        }
      }),
    ],
    [publishHistoryState, runHistoryCommand]
  );

  const extensions = React.useMemo(
    () =>
      scrollSyncExtension
        ? [...markdownEditorExtensions, ...commandExtension, scrollSyncExtension]
        : [...markdownEditorExtensions, ...commandExtension],
    [commandExtension, scrollSyncExtension],
  );

  const scrollToRatio = React.useCallback((ratio: number) => {
    const scroller = editorViewRef.current?.scrollDOM;
    if (!scroller) {
      return;
    }

    const maxScroll = scroller.scrollHeight - scroller.clientHeight;
    if (maxScroll <= 0) {
      return;
    }

    const clampedRatio = Math.min(1, Math.max(0, ratio));
    scroller.scrollTop = clampedRatio * maxScroll;
  }, []);

  const scrollToLine = React.useCallback((line: number) => {
    const view = editorViewRef.current;
    if (!view) {
      return;
    }

    const clampedLine = Math.min(Math.max(1, line), view.state.doc.lines);
    const position = view.state.doc.line(clampedLine).from;
    const block = view.lineBlockAt(position);
    view.scrollDOM.scrollTop = Math.max(0, block.top - 8);
  }, []);

  React.useEffect(() => {
    if (!onScrollController) {
      return;
    }

    onScrollController({ scrollToLine, scrollToRatio });

    return () => {
      onScrollController({
        scrollToLine: () => {},
        scrollToRatio: () => {},
      });
    };
  }, [onScrollController, scrollToLine, scrollToRatio]);

  React.useEffect(() => {
    onHistoryChange?.(EMPTY_EDITOR_HISTORY);
  }, [documentKey, onHistoryChange]);

  React.useEffect(() => {
    if (!onCommandController) {
      return;
    }

    const controller: EditorCommandController = {
      undo: () => {
        const view = editorViewRef.current;
        return view ? runHistoryCommand(view, "undo") : false;
      },
      redo: () => {
        const view = editorViewRef.current;
        return view ? runHistoryCommand(view, "redo") : false;
      },
      canUndo: () => {
        const view = editorViewRef.current;
        return view ? undoDepth(view.state) > 0 : false;
      },
      canRedo: () => {
        const view = editorViewRef.current;
        return view ? redoDepth(view.state) > 0 : false;
      },
      focus: () => {
        editorViewRef.current?.focus();
      },
    };

    onCommandController(controller);

    return () => {
      onCommandController(null);
    };
  }, [onCommandController, runHistoryCommand]);

  return (
    <div className="h-full overflow-hidden bg-background">
      <CodeMirror
        key={documentKey}
        value={content}
        height="100%"
        theme={markdownEditorTheme}
        extensions={extensions}
        basicSetup={{
          foldGutter: true,
          lineNumbers: true,
          highlightActiveLine: true,
        }}
        onChange={onChange}
        onCreateEditor={(view) => {
          editorViewRef.current = view;
        }}
        className="h-full text-sm"
      />
    </div>
  );
}

function EmptyDocument({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-lg bg-muted">
          <FileTextIcon className="text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-base font-medium">No note selected</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create or open a Markdown file to begin.
          </p>
        </div>
        <Button onClick={onCreate}>
          <PlusIcon data-icon="inline-start" />
          New note
        </Button>
      </div>
    </div>
  );
}

function LoadingTree() {
  return (
    <div className="flex flex-col gap-2 px-2 py-2">
      {Array.from({ length: 8 }).map((_, index) => (
        <Skeleton key={index} className="h-8 w-full" />
      ))}
    </div>
  );
}

function CreateDialog({
  state,
  name,
  onNameChange,
  onOpenChange,
  onSubmit,
}: {
  state: CreateDialogState;
  name: string;
  onNameChange: (name: string) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
}) {
  const label =
    state.open && state.kind === "folder"
      ? "New folder"
      : state.open && state.kind === "sub-note"
        ? "New sub-note"
        : "New note";

  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            {state.open ? `Parent: ${displayPath(state.parent)}` : ""}
          </DialogDescription>
        </DialogHeader>
        <Input
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onSubmit();
            }
          }}
          autoFocus
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RenameDialog({
  state,
  onChange,
  onOpenChange,
  onSubmit,
}: {
  state: RenameDialogState;
  onChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename</DialogTitle>
          <DialogDescription>
            {state.open ? displayPath(state.node.path) : ""}
          </DialogDescription>
        </DialogHeader>
        <Input
          value={state.open ? state.value : ""}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onSubmit();
            }
          }}
          autoFocus
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit}>Rename</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MoveDialog({
  state,
  workspaceRoot,
  onChange,
  onOpenChange,
  onSubmit,
}: {
  state: MoveDialogState;
  workspaceRoot: string;
  onChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
}) {
  async function browseDestination() {
    const selected = await browseFolder("Choose move destination", workspaceRoot);
    if (!selected) {
      return;
    }

    const destination = workspaceRelativePath(workspaceRoot, selected);
    if (destination === null) {
      toast.error("Choose a folder inside the current Typeset workspace");
      return;
    }

    onChange(destination);
  }

  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move</DialogTitle>
          <DialogDescription>
            {state.open ? `Moving ${state.node.name}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              className="min-w-0 flex-1"
              value={state.open ? state.destination : ""}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  onSubmit();
                }
              }}
              placeholder="Workspace folder, or blank for root"
              autoFocus
            />
            <Button type="button" variant="outline" onClick={browseDestination}>
              <FolderOpenIcon data-icon="inline-start" />
              Browse
            </Button>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            Pick a folder inside the current workspace, or leave blank to move
            to the root.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit}>Move</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WorkspaceSettingsDialog({
  open,
  busy,
  settings,
  location,
  onLocationChange,
  onOpenChange,
  onSubmit,
  updateState,
  onCheckUpdate,
  onOpenUpdate,
}: {
  open: boolean;
  busy: boolean;
  settings: WorkspaceSettings | null;
  location: string;
  onLocationChange: (location: string) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  updateState: UpdateUiState;
  onCheckUpdate: () => void;
  onOpenUpdate: () => void;
}) {
  async function browseWorkspaceLocation() {
    const selected = await browseFolder(
      "Choose Typeset workspace location",
      location || settings?.defaultRootPath
    );
    if (selected) {
      onLocationChange(selected);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Choose where Typeset stores the generated .typeset workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label
              className="text-sm font-medium text-foreground"
              htmlFor="workspace-location"
            >
              Workspace location
            </label>
            <div className="flex gap-2">
              <Input
                id="workspace-location"
                className="min-w-0 flex-1"
                value={location}
                onChange={(event) => onLocationChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    onSubmit();
                  }
                }}
                placeholder={settings?.defaultRootPath ?? "Documents/.typeset"}
                spellCheck={false}
              />
              <Button
                type="button"
                variant="outline"
                onClick={browseWorkspaceLocation}
              >
                <FolderOpenIcon data-icon="inline-start" />
                Browse
              </Button>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              Enter a parent folder or a .typeset folder. The parent folder must
              already exist.
            </p>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-foreground">
              Allowed locations
            </div>
            <div className="flex flex-wrap gap-2">
              {(settings?.allowedRoots ?? []).map((root) => (
                <Badge
                  key={root}
                  variant="secondary"
                  className="max-w-full truncate font-normal"
                >
                  {root}
                </Badge>
              ))}
            </div>
          </div>

          {settings?.defaultRootPath && (
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Default: {settings.defaultRootPath}
            </div>
          )}

          <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground">
                  Updates
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Current version: {updateState.currentVersion}
                </p>
                <p className="text-xs leading-5 text-muted-foreground">
                  {updateStatusText(updateState)}
                </p>
              </div>
              <Badge variant={updateState.status === "available" ? "default" : "secondary"}>
                {updateStatusLabel(updateState.status)}
              </Badge>
            </div>
            {updateState.error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {updateState.error}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onCheckUpdate}
                disabled={
                  updateState.status === "checking" ||
                  updateState.status === "downloading" ||
                  updateState.status === "installing"
                }
              >
                <RefreshCwIcon data-icon="inline-start" />
                Check
              </Button>
              {updateState.status === "available" && (
                <Button type="button" onClick={onOpenUpdate}>
                  <DownloadIcon data-icon="inline-start" />
                  View update
                </Button>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={busy || !location.trim()}>
            Save location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function updateStatusLabel(status: UpdateStatus) {
  switch (status) {
    case "checking":
      return "Checking";
    case "available":
      return "Available";
    case "up-to-date":
      return "Current";
    case "unsupported":
      return "Desktop only";
    case "downloading":
      return "Downloading";
    case "installing":
      return "Installing";
    case "error":
      return "Error";
    default:
      return "Idle";
  }
}

function updateStatusText(state: UpdateUiState) {
  switch (state.status) {
    case "checking":
      return "Checking GitHub Releases for a signed Typeset update.";
    case "available":
      return `Typeset v${state.latestVersion} is ready to install.`;
    case "up-to-date":
      return "Typeset is up to date.";
    case "unsupported":
      return "Update checks are available in the packaged desktop app.";
    case "downloading":
      return "Downloading the signed update package.";
    case "installing":
      return "Installing the update. Typeset will restart.";
    case "error":
      return "Typeset could not check for updates.";
    default:
      return "No update check has run yet.";
  }
}

function UpdateDialog({
  open,
  state,
  onOpenChange,
  onCheckUpdate,
  onInstall,
}: {
  open: boolean;
  state: UpdateUiState;
  onOpenChange: (open: boolean) => void;
  onCheckUpdate: () => void;
  onInstall: () => void;
}) {
  const busy = state.status === "checking" ||
    state.status === "downloading" ||
    state.status === "installing";
  const progressText =
    state.percent !== undefined
      ? `${state.percent}%`
      : state.downloadedBytes > 0
        ? formatBytes(state.downloadedBytes)
        : "Waiting";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Typeset update</DialogTitle>
          <DialogDescription>
            Install signed updates published from GitHub Releases.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-border bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground">
                  {state.status === "available"
                    ? `Typeset v${state.latestVersion}`
                    : "Typeset"}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Current version: {state.currentVersion}
                </div>
              </div>
              <Badge variant={state.status === "available" ? "default" : "secondary"}>
                {updateStatusLabel(state.status)}
              </Badge>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              {updateStatusText(state)}
            </p>
          </div>

          {(state.status === "downloading" || state.status === "installing") && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{state.status === "installing" ? "Installing" : "Downloading"}</span>
                <span>{progressText}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${state.percent ?? 12}%` }}
                />
              </div>
            </div>
          )}

          {state.body && (
            <div className="max-h-52 overflow-y-auto rounded-md border border-border bg-background p-3">
              <div className="mb-2 text-xs font-medium text-muted-foreground">
                Release notes
              </div>
              <div className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                {state.body}
              </div>
            </div>
          )}

          {state.error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {state.error}
            </div>
          )}

          {state.status === "available" && (
            <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs leading-5 text-muted-foreground">
              Installing an update will close Typeset while Windows runs the
              updater.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            variant="outline"
            onClick={onCheckUpdate}
            disabled={busy}
          >
            <RefreshCwIcon data-icon="inline-start" />
            Check again
          </Button>
          <Button
            onClick={onInstall}
            disabled={state.status !== "available"}
          >
            <DownloadIcon data-icon="inline-start" />
            Update
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
