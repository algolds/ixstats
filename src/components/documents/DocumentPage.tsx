import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseMarkdownDocument, remarkDocument } from "~/lib/markdown-document";
import { DocumentLayout } from "./DocumentLayout";

const linkClass = "font-medium text-amber-600 underline hover:opacity-80 dark:text-amber-400";

/** Facet typography for markdown documents (callouts are blockquotes, see `remarkDocument`). */
const documentComponents: Components = {
  h2: ({ id, children }) => (
    <h2
      id={id}
      className="text-foreground border-border/50 mt-10 scroll-mt-24 border-t pt-8 text-xl font-bold tracking-tight first:mt-0 first:border-t-0 first:pt-0 sm:text-2xl"
    >
      {children}
    </h2>
  ),
  h3: ({ id, children }) => (
    <h3
      id={id}
      className="text-foreground mt-6 mb-2 scroll-mt-24 text-sm font-semibold sm:text-base"
    >
      {children}
    </h3>
  ),
  p: ({ children }) => <p className="my-3">{children}</p>,
  ul: ({ children }) => <ul className="my-3 list-disc space-y-1.5 pl-6">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-1.5 pl-6">{children}</ol>,
  strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
  code: ({ children }) => (
    <code className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono text-[0.9em]">
      {children}
    </code>
  ),
  a: ({ href = "", children }) =>
    href.startsWith("/") ? (
      <Link href={href} className={linkClass}>
        {children}
      </Link>
    ) : (
      <a href={href} className={linkClass}>
        {children}
      </a>
    ),
  blockquote: ({ node, children }) => {
    const warning = node?.properties.dataCallout === "warning";
    return (
      <aside
        role="note"
        data-callout={warning ? "warning" : "note"}
        className={`my-5 rounded-xl border px-4 py-1 text-sm ${
          warning ? "border-amber-500/30 bg-amber-500/10" : "border-border bg-muted/30"
        }`}
      >
        {children}
      </aside>
    );
  },
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="text-foreground border-border border-b py-2 pr-4 font-semibold">{children}</th>
  ),
  td: ({ children }) => <td className="border-border/50 border-b py-1.5 pr-4">{children}</td>,
};

export function MarkdownBody({ source }: { source: string }) {
  return (
    <div className="text-muted-foreground text-sm leading-relaxed sm:text-base">
      <Markdown remarkPlugins={[remarkGfm, remarkDocument]} components={documentComponents}>
        {source}
      </Markdown>
    </div>
  );
}

async function readContent(file: string): Promise<string> {
  try {
    // Read at request time; the standalone build must ship src/content (traced from this call).
    return await readFile(path.join(process.cwd(), "src/content", file), "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") notFound();
    throw error;
  }
}

interface DocumentPageProps {
  /** Path under `src/content/`, e.g. `legal/terms.md`. */
  file: string;
  back: { href: string; label: string };
}

/** Renders one markdown document (help article, terms, privacy) in the shared layout. */
export async function DocumentPage({ file, back }: DocumentPageProps) {
  const doc = parseMarkdownDocument(await readContent(file));
  return (
    <DocumentLayout
      meta={doc.meta}
      sections={doc.headings.filter((heading) => heading.depth === 2)}
      back={back}
    >
      <MarkdownBody source={doc.body} />
    </DocumentLayout>
  );
}
