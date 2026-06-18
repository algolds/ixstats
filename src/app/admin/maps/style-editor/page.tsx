"use client";
export const dynamic = "force-dynamic";

import { usePageTitle } from "~/hooks/usePageTitle";
import { StyleEditorRouter } from "./_components/StyleEditorRouter";

export default function StyleEditorPage() {
  usePageTitle({ title: "Admin - Style Editor" });

  return (
    <div className="bg-background text-foreground absolute inset-0 z-40">
      <StyleEditorRouter />
    </div>
  );
}
