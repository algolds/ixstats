import { readFile } from "node:fs/promises";
import path from "node:path";
import { type Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { DocumentPage } from "~/components/documents/DocumentPage";
import { parseMarkdownDocument } from "~/lib/markdown-document";
import { retiredHelpArticles } from "../../_lib/help-sections";

const SEGMENT = /^[a-z0-9-]+$/;

type Params = Promise<{ category: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { category, slug } = await params;
  if (!SEGMENT.test(category) || !SEGMENT.test(slug)) return {};
  try {
    const source = await readFile(
      path.join(process.cwd(), "src/content/help", category, `${slug}.md`),
      "utf8"
    );
    const { meta } = parseMarkdownDocument(source);
    return {
      title: meta.title ? `${meta.title} - Help Center - IxStats` : "Help Center - IxStats",
      description: meta.description,
    };
  } catch {
    return { title: "Help Center - IxStats" };
  }
}

export default async function HelpArticlePage({ params }: { params: Params }) {
  const { category, slug } = await params;
  if (!SEGMENT.test(category) || !SEGMENT.test(slug)) notFound();
  const replacement = retiredHelpArticles[`${category}/${slug}`];
  if (replacement) permanentRedirect(replacement);
  return (
    <DocumentPage
      file={`help/${category}/${slug}.md`}
      back={{ href: "/help", label: "Help center" }}
    />
  );
}
