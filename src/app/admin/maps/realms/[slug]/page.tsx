"use client";
export const dynamic = "force-dynamic";

import { useParams } from "next/navigation";
import { AtlasRealmPage } from "../../_components/atlas/AtlasRealmPage";

export default function AdminAtlasRealmPage() {
  const { slug } = useParams<{ slug: string }>();
  return <AtlasRealmPage slug={slug} />;
}
