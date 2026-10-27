import type { Data, Nodes, Root } from "mdast";

/**
 * Markdown documents under `src/content/` (help articles, terms, privacy).
 *
 * Conventions:
 * - Frontmatter is a `---` block of `key: value` lines.
 * - A heading may pin its anchor with a trailing `{#id}`; otherwise the id is a slug of its text.
 * - A blockquote is a callout; a first line of `[!WARNING]` makes it a warning callout.
 */

export type DocumentMeta = Partial<Record<string, string>>;

export interface DocumentHeading {
  depth: number;
  title: string;
  id: string;
}

interface MarkdownDocument {
  meta: DocumentMeta;
  body: string;
  headings: DocumentHeading[];
}

const EXPLICIT_ID = /\s*\{#([a-z0-9-]+)\}$/;
const WARNING_MARKER = /^\[!WARNING\]\s*/;

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-");
}

/** Splits `Title {#id}` into its visible title and anchor id. */
export function headingAnchor(text: string): { title: string; id: string } {
  const match = EXPLICIT_ID.exec(text);
  const title = match ? text.slice(0, match.index) : text;
  return { title, id: match?.[1] ?? slugify(title) };
}

export function parseMarkdownDocument(source: string): MarkdownDocument {
  const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(source);
  const meta: DocumentMeta = {};
  for (const line of frontmatter?.[1]?.split("\n") ?? []) {
    const separator = line.indexOf(": ");
    if (separator > 0) meta[line.slice(0, separator)] = line.slice(separator + 2).trim();
  }
  const body = frontmatter ? source.slice(frontmatter[0].length) : source;
  const headings = [...body.matchAll(/^(#{2,3}) (.+)$/gm)].map(([, hashes = "", text = ""]) => ({
    depth: hashes.length,
    ...headingAnchor(text.trim()),
  }));
  return { meta, body, headings };
}

function textOf(node: Nodes): string {
  if ("value" in node) return node.value;
  let text = "";
  if ("children" in node) for (const child of node.children) text += textOf(child);
  return text;
}

function setHastProperties(node: { data?: Data }, properties: Record<string, string>): void {
  const data: Data & { hProperties?: Record<string, string> } = {
    ...node.data,
    hProperties: properties,
  };
  node.data = data;
}

function annotate(node: Nodes): void {
  if (node.type === "heading") {
    const last = node.children[node.children.length - 1];
    setHastProperties(node, { id: headingAnchor(textOf(node)).id });
    if (last?.type === "text") last.value = last.value.replace(EXPLICIT_ID, "");
  }
  if (node.type === "blockquote") {
    const first = node.children[0];
    const lead = first?.type === "paragraph" ? first.children[0] : undefined;
    const warning = lead?.type === "text" && WARNING_MARKER.test(lead.value);
    if (lead?.type === "text") lead.value = lead.value.replace(WARNING_MARKER, "");
    setHastProperties(node, { dataCallout: warning ? "warning" : "note" });
  }
  if ("children" in node) for (const child of node.children) annotate(child);
}

/** Remark plugin: heading ids (matching `parseMarkdownDocument`) and callout tones. */
export function remarkDocument() {
  return (tree: Root) => annotate(tree);
}
