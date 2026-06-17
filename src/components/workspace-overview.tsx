"use client";

import * as React from "react";
import {
  ClockIcon,
  FileTextIcon,
  FolderTreeIcon,
  HardDriveIcon,
} from "lucide-react";

import {
  FolderBadge,
  type FolderColorKey,
} from "@/components/folder-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { TreeNode } from "@/lib/typeset-api";

export type RecentNote = {
  path: string;
  name: string;
  external: boolean;
  openedAt: string;
};

type FolderSummary = {
  path: string;
  name: string;
  bytes: number;
  noteCount: number;
  folderCount: number;
};

const segmentClasses: Record<FolderColorKey, string> = {
  violet: "bg-violet-400",
  cyan: "bg-cyan-400",
  amber: "bg-amber-400",
  pink: "bg-pink-400",
  emerald: "bg-emerald-400",
};

export function WorkspaceOverview({
  tree,
  workspaceRoot,
  recentNotes,
  folderColorForPath,
  onOpenNote,
  onOpenRecent,
  onCreateNote,
}: {
  tree: TreeNode[];
  workspaceRoot: string;
  recentNotes: RecentNote[];
  folderColorForPath: (path: string) => FolderColorKey;
  onOpenNote: (path: string) => void;
  onOpenRecent: (note: RecentNote) => void;
  onCreateNote: () => void;
}) {
  const notes = React.useMemo(() => flattenNotes(tree), [tree]);
  const folders = React.useMemo(() => flattenFolders(tree), [tree]);
  const topFolders = React.useMemo(
    () =>
      folders
        .map((folder) => ({
          path: folder.path,
          name: folder.name,
          bytes: folder.bytes,
          noteCount: folder.noteCount,
          folderCount: folder.folderCount,
        }))
        .sort((a, b) => b.bytes - a.bytes),
    [folders]
  );
  const visibleFolders = topFolders.slice(0, 3);
  const distribution = topFolders.slice(0, 5);
  const totalBytes = notes.reduce((total, note) => total + note.ownBytes, 0);
  const largestFolder = topFolders[0];

  return (
    <ScrollOverview>
      <div className="flex flex-col gap-5 p-4">
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={HardDriveIcon}
            label="Markdown storage"
            value={formatBytes(totalBytes)}
            detail={workspaceRoot || "Documents/.typeset"}
          />
          <MetricCard
            icon={FileTextIcon}
            label="Notes"
            value={String(notes.length)}
            detail="Managed .md files"
          />
          <MetricCard
            icon={FolderTreeIcon}
            label="Folders"
            value={String(folders.length)}
            detail="Visible folders and subfolders"
          />
          <MetricCard
            icon={ClockIcon}
            label="Recent"
            value={String(recentNotes.length)}
            detail="Tracked locally on this device"
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-w-0 flex-col gap-4">
            <div>
              <h2 className="px-1 text-sm font-medium text-muted-foreground">
                Folders
              </h2>
              {visibleFolders.length ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                  {visibleFolders.map((folder) => (
                    <FolderSizeCard
                      key={folder.path}
                      folder={folder}
                      color={folderColorForPath(folder.path)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyOverview
                  title="No folders yet"
                  description="Create folders from the sidebar to group notes and sub-notes."
                  onCreateNote={onCreateNote}
                />
              )}
            </div>

            <Card className="rounded-lg">
              <CardHeader className="border-b">
                <CardTitle>All Markdown Files</CardTitle>
                <CardDescription>
                  Every managed `.md` file, including sub-notes.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {notes.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Path</TableHead>
                        <TableHead className="text-right">Size</TableHead>
                        <TableHead>Modified</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {notes
                        .slice()
                        .sort(sortByUpdatedAt)
                        .map((note) => (
                          <TableRow key={note.id}>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 justify-start px-2"
                                onClick={() => onOpenNote(note.path)}
                              >
                                <FileTextIcon data-icon="inline-start" />
                                {noteTitle(note.name)}
                              </Button>
                            </TableCell>
                            <TableCell className="max-w-[24rem] truncate text-muted-foreground">
                              {note.path}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatBytes(note.ownBytes)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatDate(note.updatedAt)}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                ) : (
                  <EmptyOverview
                    title="No notes yet"
                    description="Create your first Markdown note to populate the workspace index."
                    onCreateNote={onCreateNote}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <aside className="flex min-w-0 flex-col gap-4">
            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle>Storage Overview</CardTitle>
                <CardDescription>
                  {formatBytes(totalBytes)} across {notes.length} notes
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                  {distribution.length ? (
                    distribution.map((folder) => {
                      const color = folderColorForPath(folder.path);
                      return (
                        <span
                          key={folder.path}
                          className={cn("h-full", segmentClasses[color])}
                          style={{
                            width: `${Math.max((folder.bytes / Math.max(totalBytes, 1)) * 100, 4)}%`,
                          }}
                        />
                      );
                    })
                  ) : (
                    <span className="h-full w-full bg-muted-foreground/20" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {distribution.map((folder) => {
                    const color = folderColorForPath(folder.path);
                    return (
                      <div
                        key={folder.path}
                        className="flex items-center gap-2 rounded-md bg-muted/50 px-2 py-1.5 text-sm"
                      >
                        <span
                          className={cn("size-2.5 rounded-full", segmentClasses[color])}
                        />
                        <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                        <span className="font-medium tabular-nums">
                          {formatBytes(folder.bytes)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {largestFolder ? (
                  <Badge variant="secondary" className="w-fit">
                    Largest: {largestFolder.name}
                  </Badge>
                ) : null}
              </CardContent>
            </Card>

            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle>Recent Files</CardTitle>
                <CardDescription>Last 4 opened Markdown files.</CardDescription>
              </CardHeader>
              <CardContent>
                {recentNotes.length ? (
                  <div className="flex flex-col gap-1">
                    {recentNotes.slice(0, 4).map((note) => (
                      <Button
                        key={`${note.external ? "external" : "managed"}:${note.path}`}
                        variant="ghost"
                        className="h-auto justify-start px-2 py-2 text-left"
                        onClick={() => onOpenRecent(note)}
                      >
                        <FileTextIcon data-icon="inline-start" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {noteTitle(note.name)}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {note.external ? "External" : note.path}
                          </span>
                        </span>
                      </Button>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Open notes to build local recents.
                  </div>
                )}
              </CardContent>
            </Card>
          </aside>
        </section>
      </div>
    </ScrollOverview>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardAction>
          <div className="flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Icon />
          </div>
        </CardAction>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="truncate text-xs text-muted-foreground">{detail}</div>
      </CardContent>
    </Card>
  );
}

function FolderSizeCard({
  folder,
  color,
}: {
  folder: FolderSummary;
  color: FolderColorKey;
}) {
  return (
    <Card className="rounded-lg">
      <CardHeader>
        <FolderBadge
          color={color}
          folderSize={{ width: 34, height: 26 }}
          hoverImageSize={{ width: 42, height: 28 }}
        />
        <CardTitle className="mt-4 truncate">{folder.name}</CardTitle>
        <CardDescription>
          {folder.noteCount} files - {folder.folderCount} folders
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-lg font-medium tabular-nums">
          {formatBytes(folder.bytes)}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyOverview({
  title,
  description,
  onCreateNote,
}: {
  title: string;
  description: string;
  onCreateNote: () => void;
}) {
  return (
    <div className="mt-3 flex min-h-44 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center">
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="mt-1 max-w-md text-sm text-muted-foreground">
          {description}
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onCreateNote}>
        <FileTextIcon data-icon="inline-start" />
        New note
      </Button>
    </div>
  );
}

function ScrollOverview({ children }: { children: React.ReactNode }) {
  return <div className="no-scrollbar h-full overflow-auto">{children}</div>;
}

function flattenNotes(nodes: TreeNode[]): TreeNode[] {
  return nodes.flatMap((node) => [
    ...(node.kind === "note" ? [node] : []),
    ...flattenNotes(node.children),
  ]);
}

function flattenFolders(nodes: TreeNode[]): TreeNode[] {
  return nodes.flatMap((node) => [
    ...(node.kind === "folder" ? [node] : []),
    ...flattenFolders(node.children),
  ]);
}

function noteTitle(name: string) {
  return name.toLowerCase().endsWith(".md") ? name.slice(0, -3) : name;
}

function sortByUpdatedAt(left: TreeNode, right: TreeNode) {
  return (
    new Date(right.updatedAt ?? 0).getTime() -
    new Date(left.updatedAt ?? 0).getTime()
  );
}

function formatBytes(bytes: number) {
  if (!bytes) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  const precision = size >= 10 || unit === 0 ? 0 : 1;
  return `${size.toFixed(precision)} ${units[unit]}`;
}

function formatDate(value: string | undefined) {
  if (!value) {
    return "Unknown";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
