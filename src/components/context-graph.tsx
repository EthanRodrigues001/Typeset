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
  graphData: { nodes: GraphNode[]; links: GraphEdge[] };
  backgroundColor: string;
  nodeRelSize: number;
  nodeVal: (node: GraphNode) => number;
  linkDirectionalParticles: (edge: GraphEdge) => number;
  linkDirectionalParticleSpeed: number;
  linkColor: (edge: GraphEdge) => string;
  linkWidth: (edge: GraphEdge) => number;
  cooldownTicks: number;
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
  heading: "#facc15",
  note: "#a78bfa",
  tag: "#f472b6",
};

const EDGE_COLORS: Record<ContextEdge["kind"], string> = {
  contains: "rgba(148, 163, 184, 0.34)",
  has_readme: "rgba(56, 189, 248, 0.5)",
  has_heading: "rgba(250, 204, 21, 0.42)",
  links_to: "rgba(167, 139, 250, 0.5)",
  tagged: "rgba(244, 114, 182, 0.46)",
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
    if (!graph || !selectedId) {
      return null;
    }
    return graph.nodes.find((node) => node.id === selectedId) ?? null;
  }, [graph, selectedId]);

  React.useEffect(() => {
    if (!nodes.length) {
      return;
    }
    const timeout = window.setTimeout(() => {
      graphRef.current?.zoomToFit(450, 70);
    }, 160);
    return () => window.clearTimeout(timeout);
  }, [nodes.length, edges.length]);

  const handleNodeClick = React.useCallback(
    (node: GraphNode) => {
      setSelectedId(node.id);
      const now = Date.now();
      const previous = lastNodeClickRef.current;
      lastNodeClickRef.current = { id: node.id, time: now };

      if (
        previous?.id === node.id &&
        now - previous.time < 360 &&
        canOpenContextNode(node)
      ) {
        onOpenPath(node.path!);
      }
    },
    [onOpenPath]
  );

  const readmeCount = graph?.nodes.filter((node) => node.kind === "readme").length ?? 0;
  const folderCount = graph?.nodes.filter((node) => node.kind === "folder").length ?? 0;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-[#0b0b0b]">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <NetworkIcon className="size-4" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-foreground">Context graph</h2>
            <p className="truncate text-xs text-muted-foreground">
              README context plus generated layout metadata
            </p>
          </div>
        </div>
        <Badge variant="secondary">{readmeCount} README</Badge>
        <Badge variant="outline">{folderCount} folders</Badge>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshCwIcon data-icon="inline-start" className={cn(loading && "animate-spin")} />
          Refresh Index
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <section className="relative min-h-0 flex-1 overflow-hidden">
          <div className="absolute left-4 top-4 z-10 w-[min(28rem,calc(100%-2rem))]">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-10 border-border/80 bg-background/90 pl-9 backdrop-blur"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search folders, README context, headings, tags, links"
            />
          </div>

          {loading && !graph ? (
            <GraphLoading />
          ) : nodes.length ? (
            <ForceGraph2D
              ref={graphRef}
              graphData={{ nodes, links: edges }}
              backgroundColor="#0b0b0b"
              nodeRelSize={4}
              nodeVal={(node: GraphNode) => nodeSize(node)}
              linkDirectionalParticles={(edge: GraphEdge) =>
                edge.kind === "links_to" ? 2 : 0
              }
              linkDirectionalParticleSpeed={0.004}
              linkColor={(edge: GraphEdge) => EDGE_COLORS[edge.kind] ?? EDGE_COLORS.contains}
              linkWidth={(edge: GraphEdge) => (edge.kind === "links_to" ? 1.35 : 0.9)}
              cooldownTicks={90}
              onNodeClick={handleNodeClick}
              nodePointerAreaPaint={(node: GraphNode, color: string, context: CanvasRenderingContext2D) => {
                context.fillStyle = color;
                context.beginPath();
                context.arc(node.x ?? 0, node.y ?? 0, nodeSize(node) + 5, 0, 2 * Math.PI, false);
                context.fill();
              }}
              nodeCanvasObject={(node: GraphNode, context: CanvasRenderingContext2D, globalScale: number) => {
                drawNode(node, context, globalScale, selectedId === node.id);
              }}
            />
          ) : (
            <EmptyContextGraph query={query} onRefresh={onRefresh} />
          )}
        </section>

        <aside className="hidden w-80 shrink-0 border-l border-border bg-background/75 p-4 lg:block">
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
      <div className="flex h-full flex-col justify-center text-sm text-muted-foreground">
        <GitBranchIcon className="mb-3 size-6" />
        Select a node to inspect its context, headings, tags, and links.
      </div>
    );
  }

  const canOpen = canOpenContextNode(node);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {nodeIcon(node.kind)}
          <Badge variant="outline" className="capitalize">
            {node.kind.replace("_", " ")}
          </Badge>
        </div>
        <h3 className="break-words text-xl font-semibold leading-tight text-foreground">
          {node.label}
        </h3>
        {node.path && <p className="break-all text-xs text-muted-foreground">{node.path}</p>}
        {node.summary && (
          <p className="text-sm leading-6 text-muted-foreground">{node.summary}</p>
        )}
        {canOpen && node.path && (
          <Button size="sm" onClick={() => onOpenPath(node.path!)}>
            <FileTextIcon data-icon="inline-start" />
            Open {node.kind === "readme" ? "README" : "note"}
          </Button>
        )}
      </div>

      <div className="no-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        {node.headings?.length ? (
          <DetailSection title="Headings">
            {node.headings.map((heading) => (
              <div key={`${heading.level}:${heading.slug}`} className="flex items-start gap-2 text-sm">
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
    <section className="space-y-2 border-t border-border pt-4">
      <h4 className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
        {title}
      </h4>
      {children}
    </section>
  );
}

function EmptyContextGraph({ query, onRefresh }: { query: string; onRefresh: () => void }) {
  return (
    <div className="flex h-full items-center justify-center p-6 text-center">
      <div className="max-w-sm space-y-3">
        <NetworkIcon className="mx-auto size-8 text-muted-foreground" />
        <h3 className="text-lg font-semibold text-foreground">
          {query.trim() ? "No matching context" : "No README context yet"}
        </h3>
        <p className="text-sm text-muted-foreground">
          Add README.md files to folders and Typeset will map them here with headings, tags, and links.
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

function canOpenContextNode(node: ContextNode) {
  return Boolean(
    node.path &&
      (node.kind === "readme" || node.kind === "note") &&
      node.path.toLowerCase().endsWith(".md")
  );
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
      return 9;
    case "folder":
      return 7;
    case "readme":
      return 8;
    case "heading":
      return 4.5;
    case "tag":
      return 4.25;
    default:
      return 5.5;
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
  context.fillStyle = selected ? "rgba(255, 255, 255, 0.16)" : "rgba(255, 255, 255, 0.08)";
  context.fill();

  context.beginPath();
  context.arc(x, y, radius, 0, 2 * Math.PI, false);
  context.fillStyle = color;
  context.fill();

  context.lineWidth = selected ? 1.8 : 1;
  context.strokeStyle = selected ? "rgba(255, 255, 255, 0.86)" : "rgba(255, 255, 255, 0.38)";
  context.stroke();

  if (selected || globalScale > 1.15 || node.kind === "workspace") {
    const fontSize = Math.max(8, 12 / globalScale);
    context.font = `600 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "top";
    context.fillStyle = "rgba(245, 245, 245, 0.92)";
    context.fillText(trimLabel(node.label), x, y + radius + 4);
  }
  context.restore();
}

function trimLabel(label: string) {
  return label.length > 28 ? `${label.slice(0, 25)}...` : label;
}

function nodeIcon(kind: ContextNode["kind"]) {
  switch (kind) {
    case "folder":
      return <FolderOpenIcon className="size-4 text-green-400" />;
    case "readme":
      return <FileTextIcon className="size-4 text-sky-400" />;
    case "heading":
      return <HashIcon className="size-4 text-yellow-300" />;
    case "tag":
      return <TagIcon className="size-4 text-pink-400" />;
    case "workspace":
      return <NetworkIcon className="size-4 text-foreground" />;
    default:
      return <FileTextIcon className="size-4 text-violet-400" />;
  }
}