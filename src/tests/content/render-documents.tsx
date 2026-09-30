// Renders markdown documents to HTML for markdown-documents.test.ts. It runs under Bun because
// react-markdown is ESM-only and the Jest config does not transform node_modules.
// Usage: bun src/tests/content/render-documents.tsx <file under src/content>... (outputs NUL-separated HTML)
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownBody } from "~/components/documents/DocumentPage";
import { parseMarkdownDocument } from "~/lib/markdown-document";

const html = process.argv.slice(2).map((file) => {
  const { body } = parseMarkdownDocument(readFileSync(path.join("src/content", file), "utf8"));
  return renderToStaticMarkup(<MarkdownBody source={body} />);
});
process.stdout.write(html.join("\0"));
