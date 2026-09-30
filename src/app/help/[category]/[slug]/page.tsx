import { notFound } from "next/navigation";
import { DocumentPage } from "~/components/documents/DocumentPage";

const SEGMENT = /^[a-z0-9-]+$/;

export default async function HelpArticlePage({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}) {
  const { category, slug } = await params;
  if (!SEGMENT.test(category) || !SEGMENT.test(slug)) notFound();
  return (
    <DocumentPage
      file={`help/${category}/${slug}.md`}
      back={{ href: "/help", label: "Help Center" }}
    />
  );
}
