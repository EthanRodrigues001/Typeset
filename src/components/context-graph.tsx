"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  FileTextIcon,
  FolderOpenIcon,
  GitBranchIcon,
  HashIcon,
  NetworkIcon,
  RefreshCwIcon,
  SearchIcon,
  TagIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ContextEdge, ContextGraph, ContextNode } from "@/lib/typeset-api";

type GraphNode = ContextNode & {
  x?: number;
  y?: number;
};

type GraphEdge = Omit<ContextEdge, "source" | "target"> & {
  source: string | GraphNode;
  target: string | GraphNode;
};

type ForceGraphHandle = {
  zoomToFit: (duration?: number, padding?: number) => void;
};

type ForceGraph2DProps = {
  ref?: React.MutableRefObject<ForceGraphHandle | null>;
  width?: number;
  height?: number;
  graphData: { nodes: GraphNode[]; links: GraphEdge[] };
  backgroundColor: string;
  nodeRelSize: number;
  nodeVal: (node: GraphNode) => number;
  linkDirectionalParticles: (edge: GraphEdge) => number;
  linkDirectionalParticleSpeed: number;
  linkColor: (edge: GraphEdge) => string;
  linkWidth: (edge: GraphEdge) => number;
  cooldownTicks: number;
  d3VelocityDecay?: number;
  onNodeClick: (node: GraphNode) => void;
  nodePointerAreaPaint: (
    node: GraphNode,
    color: string,
    context: CanvasRenderingContext2D
  ) => void;
  nodeCanvasObject: (
    node: GraphNode,
    context: CanvasRenderingContext2D,
    globalScale: number
  ) => void;
};

const ForceGraph2D = dynamic<ForceGraph2DProps>(
  () =>
    import("react-force-graph-2d").then(
      (module) => module.default as unknown as React.ComponentType<ForceGraph2DProps>
    ),
  {
    ssr: false,
    loading: () => <GraphLoading />,
  }
);

const NODE_COLORS: Record<ContextNode["kind"], string> = {
  workspace: "#f8fafc",
  folder: "#22c55e",
  readme: "#38bdf8",
  heading: "#c4b5fd",
  note: "#8b5cf6",
  tag: "#f472b6",
};

const EDGE_COLORS: Record<ContextEdge["kind"], string> = {
  contains: "rgba(148, 163, 184, 0.28)",
  has_readme: "rgba(56, 189, 248, 0.48)",
  has_heading: "rgba(196, 181, 253, 0.34)",
  links_to: "rgba(139, 92, 246, 0.5)",
  tagged: "rgba(244, 114, 182, 0.42)",
};

export function ContextGraphView({
  graph,
  loading,
  query,
  onQueryChange,
  onRefresh,
  onOpenPath,
}: {
  graph: ContextGraph | null;
  loading: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  onRefresh: () => void;
  onOpenPath: (path: string) => void;
}) {
  const graphRef = React.useRef<ForceGraphHandle | null>(null);
  const graphContainerRef = React.useRef<HTMLDivElement | null>(null);
  const graphSize = useElementSize(graphContainerRef);
  const lastNodeClickRef = React.useRef<{ id: string; time: number } | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const normalizedQuery = query.trim().toLowerCase();

  const { nodes, edges } = React.useMemo(() => {
    if (!graph) {
      return { nodes: [] as GraphNode[], edges: [] as GraphEdge[] };
    }

    if (!normalizedQuery) {
      return {
        nodes: graph.nodes.map((node) => ({ ...node })),
        edges: graph.edges.map((edge) => ({ ...edge })),
      };
    }

    const matchedIds = new Set(
      graph.nodes
        .filter((node) => contextNodeText(node).includes(normalizedQuery))
        .map((node) => node.id)
    );
    const visibleIds = new Set(matchedIds);
    for (const edge of graph.edges) {
      if (matchedIds.has(edge.source) || matchedIds.has(edge.target)) {
        visibleIds.add(edge.source);
        visibleIds.add(edge.target);
      }
    }

    return {
      nodes: graph.nodes
        .filter((node) => visibleIds.has(node.id))
        .map((node) => ({ ...node })),
      edges: graph.edges
        .filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target))
        .map((edge) => ({ ...edge })),
    };
  }, [graph, normalizedQuery]);

  const selectedNode = React.useMemo(() => {
    if (!graph || !selectedId || !nodes.some((node) => node.id === selectedId)) {
      return null;
    }
    return graph.nodes.find((node) => node.id === selectedId) ?? null;
  }, [graph, nodes, selectedId]);

  React.useEffect(() => {
    if (!nodes.length || !graphSize.width || !graphSize.height) {
      return;
    }
    const timeout = window.setTimeout(() => {
      graphRef.current?.zoomToFit(420, 52);
    }, 180);
    return () => window.clearTimeout(timeout);
  }, [nodes.length, edges.length, graphSize.width, graphSize.height]);

  const handleNodeClick = React.useCallback(
    (node: GraphNode) => {
      setSelectedId(node.id);
      const now = Date.now();
      const previous = lastNodeClickRef.current;
      lastNodeClickRef.current = { id: node.id, time: now };
      const targetPath = openablePath(node);

      if (previous?.id === node.id && now - previous.time < 360 && targetPath) {
        onOpenPath(targetPath);
      }
    },
    [onOpenPath]
  );

  const markdownCount = graph?.nodes.filter((node) => node.kind === "readme" || node.kind === "note").length ?? 0;
  const readmeCount = graph?.nodes.filter((node) => node.kind === "readme").length ?? 0;
  const folderCount = graph?.nodes.filter((node) => node.kind === "folder" && node.path !== ".").length ?? 0;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="flex shrink-0 flex-wrap items-center gap-2 px-1 pb-3 pt-1">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <NetworkIcon className="size-4" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-foreground">Context graph</h2>
            <p className="truncate text-xs text-muted-foreground">
              Indexed Markdown metadata for fast graph search
            </p>
          </div>
        </div>
        <Badge variant="secondary">{markdownCount} MD files</Badge>
        <Badge variant="outline">{readmeCount} README</Badge>
        <Badge variant="outline">{folderCount} folders</Badge>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshCwIcon data-icon="inline-start" className={cn(loading && "animate-spin")} />
          Refresh Index
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
        <section className="relative min-h-0 flex-1 overflow-hidden rounded-lg bg-[#080808]">
          <div className="absolute left-4 top-4 z-10 w-[min(28rem,calc(100%-2rem))]">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-10 border-border/60 bg-background/90 pl-9 shadow-lg shadow-black/20 backdrop-blur"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search files, folders, headings, tags, links"
            />
          </div>

          <div ref={graphContainerRef} className="absolute inset-0">
            {loading && !graph ? (
              <GraphLoading />
            ) : nodes.length && graphSize.width && graphSize.height ? (
              <ForceGraph2D
                ref={graphRef}
                width={graphSize.width}
                height={graphSize.height}
                graphData={{ nodes, links: edges }}
                backgroundColor="#080808"
                nodeRelSize={2.3}
                nodeVal={(node: GraphNode) => nodeSize(node)}
                linkDirectionalParticles={(edge: GraphEdge) =>
                  edge.kind === "links_to" ? 1 : 0
                }
                linkDirectionalParticleSpeed={0.004}
                linkColor={(edge: GraphEdge) => EDGE_COLORS[edge.kind] ?? EDGE_COLORS.contains}
                linkWidth={(edge: GraphEdge) => (edge.kind === "links_to" ? 1.15 : 0.75)}
                cooldownTicks={110}
                d3VelocityDecay={0.42}
                onNodeClick={handleNodeClick}
                nodePointerAreaPaint={(node: GraphNode, color: string, context: CanvasRenderingContext2D) => {
                  context.fillStyle = color;
                  context.beginPath();
                  context.arc(node.x ?? 0, node.y ?? 0, nodeSize(node) + 7, 0, 2 * Math.PI, false);
                  context.fill();
                }}
                nodeCanvasObject={(node: GraphNode, context: CanvasRenderingContext2D, globalScale: number) => {
                  drawNode(node, context, globalScale, selectedId === node.id);
                }}
              />
            ) : (
              <EmptyContextGraph query={query} onRefresh={onRefresh} />
            )}
          </div>
        </section>

        <aside className="hidden w-[22rem] shrink-0 overflow-hidden rounded-lg bg-background/80 p-1 lg:block">
          <ContextDetails node={selectedNode} onOpenPath={onOpenPath} />
        </aside>
      </div>
    </div>
  );
}

function ContextDetails({
  node,
  onOpenPath,
}: {
  node: ContextNode | null;
  onOpenPath: (path: string) => void;
}) {
  if (!node) {
    return (
      <div className="flex h-full flex-col justify-center rounded-lg bg-muted/20 p-5 text-sm text-muted-foreground">
        <GitBranchIcon className="mb-3 size-6" />
        Select a node to inspect paths, headings, tags, links, and update metadata.
      </div>
    );
  }

  const targetPath = openablePath(node);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden rounded-lg bg-muted/20 p-5">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {nodeIcon(node.kind)}
          <Badge variant="outline" className="capitalize">
            {kindLabel(node.kind)}
          </Badge>
          {node.bytes ? <Badge variant="secondary">{formatBytes(node.bytes)}</Badge> : null}
        </div>
        <h3 className="break-words text-xl font-semibold leading-tight text-foreground">
          {node.label}
        </h3>
        {node.path && <p className="break-all text-xs text-muted-foreground">{node.path}</p>}
        {node.updatedAt && (
          <p className="text-xs text-muted-foreground">Updated {new Date(node.updatedAt).toLocaleString()}</p>
        )}
        {node.summary && (
          <p className="text-sm leading-6 text-muted-foreground">{node.summary}</p>
        )}
        {targetPath && (
          <Button size="sm" onClick={() => onOpenPath(targetPath)}>
            <FileTextIcon data-icon="inline-start" />
            Open {node.kind === "readme" ? "README" : "note"}
          </Button>
        )}
      </div>

      <div className="no-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        {node.headings?.length ? (
          <DetailSection title="Headings">
            {node.headings.map((heading) => (
              <div key={heading.level + ":" + heading.slug} className="flex items-start gap-2 text-sm">
                <span className="w-8 shrink-0 text-xs text-muted-foreground">h{heading.level}</span>
                <span className="break-words text-foreground/90">{heading.text}</span>
              </div>
            ))}
          </DetailSection>
        ) : null}

        {node.tags?.length ? (
          <DetailSection title="Tags">
            <div className="flex flex-wrap gap-1.5">
              {node.tags.map((tag) => (
                <Badge key={tag} variant="secondary">#{tag}</Badge>
              ))}
            </div>
          </DetailSection>
        ) : null}

        {node.links?.length ? (
          <DetailSection title="Links">
            {node.links.map((link) => (
              <p key={link} className="break-all text-sm text-muted-foreground">
                {link}
              </p>
            ))}
          </DetailSection>
        ) : null}
      </div>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
        {title}
      </h4>
      {children}
    </div>
  );
}

function EmptyContextGraph({ query, onRefresh }: { query: string; onRefresh: () => void }) {
  return (
    <div className="flex h-full items-center justify-center p-6 text-center">
      <div className="max-w-sm space-y-3">
        <NetworkIcon className="mx-auto size-8 text-muted-foreground" />
        <h3 className="text-lg font-semibold text-foreground">
          {query.trim() ? "No matching context" : "No indexed Markdown yet"}
        </h3>
        <p className="text-sm text-muted-foreground">
          Typeset indexes managed Markdown file names, headings, tags, links, and README summaries into CONTEXT.md.
        </p>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCwIcon data-icon="inline-start" />
          Refresh Index
        </Button>
      </div>
    </div>
  );
}

function GraphLoading() {
  return (
    <div className="flex h-full min-h-72 items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-8 w-64" />
      </div>
    </div>
  );
}

function useElementSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const update = () => {
      const rect = element.getBoundingClientRect();
      setSize({ width: Math.max(0, rect.width), height: Math.max(0, rect.height) });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

function openablePath(node: ContextNode) {
  const path = node.path?.split("#")[0];
  if (!path || !path.toLowerCase().endsWith(".md")) {
    return null;
  }
  if (["readme", "note", "heading"].includes(node.kind)) {
    return path;
  }
  return null;
}

function contextNodeText(node: ContextNode) {
  return [
    node.kind,
    node.label,
    node.path,
    node.title,
    node.summary,
    ...(node.headings?.map((heading) => heading.text) ?? []),
    ...(node.tags ?? []),
    ...(node.links ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function nodeSize(node: ContextNode) {
  switch (node.kind) {
    case "workspace":
      return 5.8;
    case "folder":
      return 5;
    case "readme":
      return 5.4;
    case "heading":
      return 2.8;
    case "tag":
      return 3.4;
    default:
      return 4.4;
  }
}

function drawNode(
  node: GraphNode,
  context: CanvasRenderingContext2D,
  globalScale: number,
  selected: boolean
) {
  const radius = nodeSize(node);
  const x = node.x ?? 0;
  const y = node.y ?? 0;
  const color = NODE_COLORS[node.kind] ?? NODE_COLORS.note;

  context.save();
  context.beginPath();
  context.arc(x, y, radius + (selected ? 4 : 2), 0, 2 * Math.PI, false);
  context.fillStyle = selected ? "rgba(255, 255, 255, 0.16)" : "rgba(255, 255, 255, 0.07)";
  context.fill();

  context.beginPath();
  context.arc(x, y, radius, 0, 2 * Math.PI, false);
  context.fillStyle = color;
  context.fill();

  context.lineWidth = selected ? 1.7 : 0.9;
  context.strokeStyle = selected ? "rgba(255, 255, 255, 0.86)" : "rgba(255, 255, 255, 0.36)";
  context.stroke();

  const shouldLabel = selected || globalScale > 0.95 || node.kind === "workspace";
  if (shouldLabel) {
    const fontSize = Math.max(5.5, Math.min(10.5, 8 / Math.max(globalScale, 0.75)));
    context.font = "600 " + fontSize + "px ui-sans-serif, system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "top";
    context.fillStyle = selected ? "rgba(255, 255, 255, 0.96)" : "rgba(245, 245, 245, 0.78)";
    context.fillText(trimLabel(node.label), x, y + radius + 4);
  }
  context.restore();
}

function trimLabel(label: string) {
  return label.length > 24 ? label.slice(0, 21) + "..." : label;
}

function kindLabel(kind: ContextNode["kind"]) {
  return kind === "readme" ? "README" : kind.replace("_", " ");
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return bytes + " B";
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return Math.round(kb) + " KB";
  }
  return (kb / 1024).toFixed(1) + " MB";
}

function nodeIcon(kind: ContextNode["kind"]) {
  switch (kind) {
    case "folder":
      return <FolderOpenIcon className="size-4 text-green-400" />;
    case "readme":
      return <FileTextIcon className="size-4 text-sky-400" />;
    case "heading":
      return <HashIcon className="size-4 text-violet-300" />;
    case "tag":
      return <TagIcon className="size-4 text-pink-400" />;
    case "workspace":
      return <NetworkIcon className="size-4 text-foreground" />;
    default:
      return <FileTextIcon className="size-4 text-violet-400" />;
  }
}
