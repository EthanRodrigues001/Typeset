"use client";

/* eslint-disable @next/next/no-img-element */

import * as React from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { Maximize2Icon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type MarkdownPreviewProps = {
  content: string;
  basePath?: string;
  onContentChange?: (content: string) => void;
  onOpenInternalLink?: (path: string) => void;
};

type PendingLink = {
  href: string;
  label: string;
  kind: "internal" | "external" | "anchor";
  resolvedPath?: string;
};

type MediaPreview =
  | {
      kind: "image";
      title: string;
      src: string;
    }
  | {
      kind: "diagram";
      title: string;
      svg: string;
    };

type HastNode = {
  type?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
  position?: {
    start?: {
      line?: number;
    };
  };
};

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "abbr",
    "aside",
    "details",
    "figcaption",
    "figure",
    "kbd",
    "mark",
    "section",
    "sub",
    "summary",
    "sup",
  ],
  attributes: {
    ...defaultSchema.attributes,
    "*": [
      ...(defaultSchema.attributes?.["*"] ?? []),
      "aria-label",
      "className",
      "id",
      "title",
    ],
    a: [
      ...(defaultSchema.attributes?.a ?? []),
      "href",
      "rel",
      "target",
      "title",
    ],
    img: [
      ...(defaultSchema.attributes?.img ?? []),
      "alt",
      "height",
      "src",
      "title",
      "width",
    ],
    input: [
      ...(defaultSchema.attributes?.input ?? []),
      "checked",
      "disabled",
      "type",
    ],
  },
};

export function MarkdownPreview({
  content,
  basePath,
  onContentChange,
  onOpenInternalLink,
}: MarkdownPreviewProps) {
  const [pendingLink, setPendingLink] = React.useState<PendingLink | null>(null);
  const [mediaPreview, setMediaPreview] = React.useState<MediaPreview | null>(
    null,
  );

  function requestOpenLink(href: string, label: string) {
    const kind = linkKind(href);
    setPendingLink({
      href,
      label,
      kind,
      resolvedPath:
        kind === "internal" ? resolveMarkdownLink(basePath, href) : undefined,
    });
  }

  function confirmOpenLink() {
    if (!pendingLink) {
      return;
    }

    if (pendingLink.kind === "anchor") {
      const target = document.querySelector(pendingLink.href);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
      setPendingLink(null);
      return;
    }

    if (
      pendingLink.kind === "internal" &&
      pendingLink.resolvedPath &&
      onOpenInternalLink
    ) {
      onOpenInternalLink(pendingLink.resolvedPath);
      setPendingLink(null);
      return;
    }

    window.open(pendingLink.href, "_blank", "noopener,noreferrer");
    setPendingLink(null);
  }

  return (
    <>
      <article className="typeset-preview">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[
            rehypeRaw,
            [rehypeSanitize, sanitizeSchema],
            rehypeTaskIndexes,
            rehypeHighlight,
          ]}
          components={{
            a({ children, href }) {
              const target = String(href ?? "");
              return (
                <a
                  href={target}
                  onClick={(event) => {
                    event.preventDefault();
                    requestOpenLink(target, textFromChildren(children));
                  }}
                >
                  {children}
                </a>
              );
            },
            blockquote({ children, node }) {
              const kind = calloutKind(children);
              return (
                <blockquote
                  {...sourceLineProps(node)}
                  className={kind ? `typeset-callout typeset-callout-${kind}` : undefined}
                >
                  {children}
                </blockquote>
              );
            },
            code({ children, className }) {
              return <code className={className}>{children}</code>;
            },
            h1({ children, node }) {
              const id = slugify(textFromChildren(children));
              return <h1 id={id} {...sourceLineProps(node)}>{children}</h1>;
            },
            h2({ children, node }) {
              const id = slugify(textFromChildren(children));
              return <h2 id={id} {...sourceLineProps(node)}>{children}</h2>;
            },
            h3({ children, node }) {
              const id = slugify(textFromChildren(children));
              return <h3 id={id} {...sourceLineProps(node)}>{children}</h3>;
            },
            h4({ children, node }) {
              const id = slugify(textFromChildren(children));
              return <h4 id={id} {...sourceLineProps(node)}>{children}</h4>;
            },
            h5({ children, node }) {
              const id = slugify(textFromChildren(children));
              return <h5 id={id} {...sourceLineProps(node)}>{children}</h5>;
            },
            h6({ children, node }) {
              const id = slugify(textFromChildren(children));
              return <h6 id={id} {...sourceLineProps(node)}>{children}</h6>;
            },
            img({ alt, src, node }) {
              const source = String(src ?? "");
              if (isRelativeImageSource(source)) {
                return (
                  <span
                    className="typeset-image-placeholder"
                    role="img"
                    aria-label={alt ?? source}
                  >
                    {alt || source}
                  </span>
                );
              }

              const label = alt || source.split("/").pop() || "Image";
              return (
                <span
                  className="typeset-media-frame"
                  {...sourceLineProps(node)}
                >
                  <img alt={alt ?? ""} src={source} loading="lazy" />
                  <FullscreenButton
                    label={`Open ${label} fullscreen`}
                    onClick={() =>
                      setMediaPreview({
                        kind: "image",
                        src: source,
                        title: label,
                      })
                    }
                  />
                </span>
              );
            },
            input({ checked, type, node }) {
              if (type === "checkbox") {
                const currentTaskIndex = taskIndexFromNode(node);
                return (
                  <button
                    aria-checked={Boolean(checked)}
                    aria-label={
                      checked ? "Mark task incomplete" : "Mark task complete"
                    }
                    className="typeset-task-checkbox"
                    disabled={!onContentChange}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      if (!onContentChange || currentTaskIndex === null) {
                        return;
                      }
                      onContentChange(
                        toggleMarkdownTask(content, currentTaskIndex)
                      );
                    }}
                    role="checkbox"
                    type="button"
                  >
                    {checked ? "✓" : ""}
                  </button>
                );
              }
              return <input type={type} readOnly />;
            },
            li({ children, node }) {
              return <li {...sourceLineProps(node)}>{children}</li>;
            },
            ol({ children, node }) {
              return <ol {...sourceLineProps(node)}>{children}</ol>;
            },
            p({ children, node }) {
              return <p {...sourceLineProps(node)}>{children}</p>;
            },
            pre({ children, node }) {
              const codeBlock = codeBlockFromPre(children);
              if (codeBlock?.language === "mermaid") {
                return (
                  <MermaidDiagram
                    chart={codeBlock.content}
                    onOpenMedia={(svg) =>
                      setMediaPreview({
                        kind: "diagram",
                        svg,
                        title: "Mermaid diagram",
                      })
                    }
                    sourceLine={sourceLineFromNode(node)}
                  />
                );
              }
              return <pre {...sourceLineProps(node)}>{children}</pre>;
            },
            table({ children, node }) {
              return (
                <div
                  className="typeset-table-wrapper"
                  {...sourceLineProps(node)}
                >
                  <table>{children}</table>
                </div>
              );
            },
            ul({ children, node }) {
              return <ul {...sourceLineProps(node)}>{children}</ul>;
            },
          }}
        >
          {content || "# Untitled"}
        </ReactMarkdown>
      </article>
      <Dialog open={Boolean(pendingLink)} onOpenChange={(open) => !open && setPendingLink(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Open link?</DialogTitle>
            <DialogDescription>
              Typeset intercepted this link so the preview does not navigate to a missing route.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted p-3 text-sm">
            <div className="font-medium">{pendingLink?.label || "Untitled link"}</div>
            <div className="mt-1 break-all text-muted-foreground">
              {pendingLink?.resolvedPath ?? pendingLink?.href}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingLink(null)}>
              Cancel
            </Button>
            <Button onClick={confirmOpenLink}>
              {pendingLink?.kind === "internal" &&
              pendingLink.resolvedPath &&
              onOpenInternalLink
                ? "Open note"
                : pendingLink?.kind === "anchor"
                  ? "Jump"
                  : "Open in browser"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(mediaPreview)}
        onOpenChange={(open) => !open && setMediaPreview(null)}
      >
        <DialogContent className="h-[94vh] w-[96vw] !max-w-[96vw] overflow-hidden p-0 sm:!max-w-[96vw]">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle>{mediaPreview?.title ?? "Preview"}</DialogTitle>
            <DialogDescription>
              Expanded preview for the selected Markdown media.
            </DialogDescription>
          </DialogHeader>
          <div className="typeset-media-dialog-body">
            {mediaPreview?.kind === "image" ? (
              <img
                alt={mediaPreview.title}
                src={mediaPreview.src}
                loading="lazy"
              />
            ) : mediaPreview?.kind === "diagram" ? (
              <div dangerouslySetInnerHTML={{ __html: mediaPreview.svg }} />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FullscreenButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="typeset-media-fullscreen"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      type="button"
    >
      <Maximize2Icon aria-hidden="true" />
    </button>
  );
}

function rehypeTaskIndexes() {
  return (tree: HastNode) => {
    let taskIndex = 0;

    visitHast(tree, (node) => {
      if (
        node.type === "element" &&
        node.tagName === "input" &&
        node.properties?.type === "checkbox"
      ) {
        node.properties = {
          ...node.properties,
          dataTaskIndex: String(taskIndex),
        };
        taskIndex += 1;
      }
    });
  };
}

function visitHast(node: HastNode, visitor: (node: HastNode) => void) {
  visitor(node);
  for (const child of node.children ?? []) {
    visitHast(child, visitor);
  }
}

function taskIndexFromNode(node: unknown) {
  const value = (node as HastNode | undefined)?.properties?.dataTaskIndex;
  if (typeof value !== "string") {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function MermaidDiagram({
  chart,
  onOpenMedia,
  sourceLine,
}: {
  chart: string;
  onOpenMedia: (svg: string) => void;
  sourceLine: number | null;
}) {
  const reactId = React.useId();
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [shouldRender, setShouldRender] = React.useState(false);
  const [svg, setSvg] = React.useState("");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container || shouldRender) {
      return;
    }

    if (!("IntersectionObserver" in window)) {
      const frame = requestAnimationFrame(() => setShouldRender(true));
      return () => cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShouldRender(true);
          observer.disconnect();
        }
      },
      { rootMargin: "900px 0px" },
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, [shouldRender]);

  React.useEffect(() => {
    if (!shouldRender) {
      return;
    }

    let cancelled = false;

    async function renderMermaid() {
      try {
        const { default: mermaid } = await import("mermaid");
        const theme = {
          background: "#1f1f1f",
          primaryColor: "#27272a",
          primaryTextColor: "#fafafa",
          primaryBorderColor: "#52525b",
          lineColor: "#a1a1aa",
          secondaryColor: "#18181b",
          tertiaryColor: "#202124",
          textColor: "#fafafa",
          nodeTextColor: "#fafafa",
          labelTextColor: "#fafafa",
          edgeLabelBackground: "#18181b",
          clusterBkg: "#18181b",
          clusterBorder: "#3f3f46",
          noteTextColor: "#fafafa",
          noteBkgColor: "#27272a",
          noteBorderColor: "#52525b",
          titleColor: "#fafafa",
        };
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          themeVariables: {
            ...theme,
            fontFamily:
              "Geist, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
          },
        });

        const id = `typeset-mermaid-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}-${hashText(chart)}`;
        const result = await mermaid.render(id, chart);
        if (!cancelled) {
          setSvg(result.svg);
          setError("");
        }
      } catch (renderError) {
        if (!cancelled) {
          setSvg("");
          setError(
            renderError instanceof Error
              ? renderError.message
              : String(renderError)
          );
        }
      }
    }

    renderMermaid();
    return () => {
      cancelled = true;
    };
  }, [chart, reactId, shouldRender]);

  if (error) {
    return (
      <div
        className="typeset-mermaid-error"
        role="alert"
        {...sourceLineDataAttribute(sourceLine)}
      >
        <div className="font-medium">Mermaid diagram failed to render</div>
        <pre>{error}</pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div
        ref={containerRef}
        className="typeset-mermaid-loading"
        {...sourceLineDataAttribute(sourceLine)}
      >
        {shouldRender ? "Rendering diagram..." : "Diagram preview"}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="typeset-mermaid"
      {...sourceLineDataAttribute(sourceLine)}
    >
      <div
        className="typeset-mermaid-canvas"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <FullscreenButton
        label="Open Mermaid diagram fullscreen"
        onClick={() => onOpenMedia(svg)}
      />
    </div>
  );
}

function sourceLineProps(node: unknown) {
  return sourceLineDataAttribute(sourceLineFromNode(node));
}

function sourceLineDataAttribute(line: number | null) {
  return line === null ? {} : { "data-source-line": String(line) };
}

function sourceLineFromNode(node: unknown) {
  const line = (node as HastNode | undefined)?.position?.start?.line;
  return typeof line === "number" && Number.isFinite(line) ? line : null;
}

function codeBlockFromPre(children: React.ReactNode) {
  const child = React.Children.toArray(children)[0];
  if (!React.isValidElement<{ className?: string; children?: React.ReactNode }>(
    child
  )) {
    return null;
  }

  const className = child.props.className ?? "";
  const language = className
    .split(/\s+/)
    .find((name) => name.startsWith("language-"))
    ?.replace("language-", "");

  if (!language) {
    return null;
  }

  return {
    content: textFromChildren(child.props.children).trim(),
    language,
  };
}

function toggleMarkdownTask(content: string, targetIndex: number) {
  const lines = content.split(/\r?\n/);
  let currentIndex = 0;

  const nextLines = lines.map((line) => {
    const match = line.match(/^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])(\]\s+)/);
    if (!match) {
      return line;
    }

    if (currentIndex !== targetIndex) {
      currentIndex += 1;
      return line;
    }

    currentIndex += 1;
    const nextMark = match[2].trim().toLowerCase() === "x" ? " " : "x";
    return line.replace(
      /^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])(\]\s+)/,
      `$1${nextMark}$3`
    );
  });

  return nextLines.join(content.includes("\r\n") ? "\r\n" : "\n");
}

function hashText(text: string) {
  let hash = 0;
  for (const character of text) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function textFromChildren(children: React.ReactNode): string {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(textFromChildren).join("");
  }
  if (React.isValidElement<{ children?: React.ReactNode }>(children)) {
    return textFromChildren(children.props.children);
  }
  return "";
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function calloutKind(children: React.ReactNode) {
  const text = textFromChildren(children).toLowerCase();
  const match = text.match(/^\s*\[!(note|tip|warning|important|caution)\]/);
  return match?.[1];
}

function linkKind(href: string): PendingLink["kind"] {
  if (href.startsWith("#")) {
    return "anchor";
  }
  if (/^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(href)) {
    return "external";
  }
  return "internal";
}

function resolveMarkdownLink(basePath: string | undefined, href: string) {
  const cleanHref = href.split("#")[0]?.split("?")[0] ?? href;
  if (!cleanHref.toLowerCase().endsWith(".md")) {
    return undefined;
  }

  const baseParts = basePath?.includes("/")
    ? basePath.split("/").slice(0, -1)
    : [];
  const parts = [...baseParts, ...cleanHref.replace(/\\/g, "/").split("/")];
  const resolved: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      resolved.pop();
      continue;
    }
    resolved.push(part);
  }
  return resolved.join("/");
}

function isRelativeImageSource(source: string) {
  if (!source) {
    return false;
  }
  return !/^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(source);
}
