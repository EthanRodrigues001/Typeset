"use client";

import * as React from "react";

import { MarkdownPreview } from "@/components/markdown-preview";
import { MARKDOWN_TEST_CONTENT } from "@/lib/markdown-test-content";

export default function MarkdownTestPage() {
  const [content, setContent] = React.useState(MARKDOWN_TEST_CONTENT);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 rounded-lg border bg-card p-4 text-card-foreground">
          <p className="text-sm font-medium">Typeset Markdown Test Page</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This route verifies Markdown, safe HTML, themed styling, images, and link confirmation behavior.
          </p>
        </div>
        <MarkdownPreview content={content} onContentChange={setContent} />
      </div>
    </main>
  );
}
