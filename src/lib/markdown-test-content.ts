export const MARKDOWN_TEST_CONTENT = `# Typeset Markdown Test

This page is a full rendering check for **Typeset Markdown**. It covers CommonMark, GitHub Flavored Markdown, safe HTML, and documentation patterns inspired by Fumadocs-style content.

## Table of Contents

- [Inline formatting](#inline-formatting)
- [Links](#links)
- [Lists and tasks](#lists-and-tasks)
- [Tables](#tables)
- [Code](#code)
- [Mermaid diagrams](#mermaid-diagrams)
- [Quotes and callouts](#quotes-and-callouts)
- [Images and media](#images-and-media)
- [HTML](#html)
- [Footnotes](#footnotes)

---

## Inline Formatting

Plain paragraph text should feel readable over long-form docs. It includes **bold**, *italic*, ***bold italic***, ~~strikethrough~~, \`inline code\`, ==literal highlight syntax==, and escaped characters like \\*not italic\\*.

HTML inline elements should also render: <mark>marked text</mark>, <kbd>Ctrl</kbd> + <kbd>K</kbd>, H<sub>2</sub>O, E = mc<sup>2</sup>, and <abbr title="Markdown">MD</abbr>.

## Links

Every link click should open a confirmation dialog before navigation:

- [External HTTPS link](https://example.com/docs)
- [Mail link](mailto:hello@example.com)
- [Workspace-relative Markdown link](Research/Links-And-Media.md)
- [Parent-relative Markdown link](../Project.md)
- [Hash link to code](#code)
- Bare URL autolink: <https://commonmark.org>
- Email autolink: <hello@example.com>

## Lists and Tasks

1. Ordered item one
2. Ordered item two
   1. Nested ordered item
   2. Nested ordered item with \`code\`
3. Ordered item three

- Unordered item
- Nested group
  - Child item
  - Another child item
- Mixed content
  > Blockquote inside a list item.

- [x] Completed task
- [ ] Incomplete task
- [x] Task with **bold** and [a link](https://example.com)

## Tables

| Feature | Status | Notes |
| --- | ---: | --- |
| Headings | Done | H1 through H6 |
| Tables | Done | GFM table alignment |
| Tasks | Done | Interactive checkboxes |
| HTML | Safe | Sanitized raw HTML |

| Left | Center | Right |
| :--- | :---: | ---: |
| Alpha | Beta | Gamma |
| 100 | 200 | 300 |

## Code

Inline code looks like \`const type = "note"\`.

\`\`\`ts
type Note = {
  title: string;
  path: string;
  tags: string[];
};

export function summarize(note: Note) {
  return \`\${note.title} -> \${note.path}\`;
}
\`\`\`

\`\`\`bash
npm run lint
npm run build
cargo test
\`\`\`

Indented code:

    const indented = true;
    console.log(indented);

## Mermaid Diagrams

\`\`\`mermaid
flowchart LR
  A[Create Markdown] --> B{Preview mode}
  B -->|Source| C[CodeMirror editor]
  B -->|Preview| D[Rendered document]
  D --> E[Clickable tasks]
  D --> F[Mermaid diagrams]
\`\`\`

\`\`\`mermaid
sequenceDiagram
  participant User
  participant Typeset
  participant Layout as LAYOUT.md
  User->>Typeset: Save note
  Typeset->>Layout: Regenerate index
  Layout-->>Typeset: Agent-friendly map
\`\`\`

## Quotes and Callouts

> A normal blockquote should be quiet, readable, and distinct from body text.

> [!NOTE]
> Notes should look like documentation callouts.

> [!TIP]
> Tips should be easy to scan without overwhelming the page.

> [!WARNING]
> Warnings should stand out clearly.

> [!IMPORTANT]
> Important sections should carry visual weight.

> [!CAUTION]
> Caution content should be visibly stronger than a note.

## Images and Media

Relative image references should not cause browser 404s:

![Relative image placeholder](assets/missing-image.png)

Remote images should render normally:

![Remote placeholder](https://placehold.co/720x240/png)

## HTML

<details open>
  <summary>Expandable details with safe HTML</summary>
  <p>This paragraph is raw HTML passed through the sanitizer.</p>
  <ul>
    <li>HTML list item</li>
    <li><strong>Nested formatting</strong> stays styled.</li>
  </ul>
</details>

<figure>
  <img src="https://placehold.co/640x180/png" alt="HTML figure placeholder" />
  <figcaption>Figure caption rendered from safe HTML.</figcaption>
</figure>

<section>
  <h3>HTML Section Heading</h3>
  <p>Section content should inherit the Markdown document theme.</p>
</section>

<script>alert("This script must be stripped")</script>

## Footnotes

Here is a footnote reference.[^one] Here is another footnote with a link.[^two]

[^one]: Footnote content should be readable and separated from body content.
[^two]: Footnotes can include [links](https://example.com/footnote), \`code\`, and emphasis.

## Heading Depth

### H3 Heading

#### H4 Heading

##### H5 Heading

###### H6 Heading
`;
