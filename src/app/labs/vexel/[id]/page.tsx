"use client";

import { use } from "react";
import VexelEditor from "~/components/maps/vexel/VexelEditor";

interface VexelEditPageProps {
  params: Promise<{ id: string }>;
}

export default function VexelEditPage({ params }: VexelEditPageProps) {
  const { id } = use(params);
  return <VexelEditor achievementId={id} />;
}
