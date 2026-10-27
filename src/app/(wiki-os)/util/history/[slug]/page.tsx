"use client";
// WikiOS Page History Hub with Scrubbable Timeline

import { useParams } from "next/navigation";
import { PageHistoryView } from "~/components/wiki-os/history/PageHistoryView";

export default function HistoryPage() {
  const params = useParams<{ slug: string }>();
  const rawSlug = params.slug ? decodeURIComponent(params.slug) : "";
  const title = rawSlug.replace(/_/g, " ");

  return <PageHistoryView title={title} slug={encodeURIComponent(rawSlug)} />;
}
