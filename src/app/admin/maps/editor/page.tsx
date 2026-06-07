"use client";
export const dynamic = "force-dynamic";

/**
 * World Editor Page - Dedicated full-page route for advanced maps editing.
 */

import dynamicImport from "next/dynamic";
import { Loader2 } from "lucide-react";
import { usePageTitle } from "~/hooks/usePageTitle";

const MapEditorOverlay = dynamicImport(() => import("~/components/maps/editor/MapEditorOverlay"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-[#0a1628]">
      <div className="text-center">
        <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-emerald-500" />
        <p className="text-sm font-medium text-white/60">Loading World Editor...</p>
      </div>
    </div>
  ),
});

export default function WorldEditorPage() {
  usePageTitle({ title: "Admin - World Editor" });

  return (
    <div className="bg-background text-foreground absolute inset-0 z-40">
      <MapEditorOverlay
        isWorldMode={true}
        onExit={() => {
          window.location.href = "/admin/maps";
        }}
      />
    </div>
  );
}
