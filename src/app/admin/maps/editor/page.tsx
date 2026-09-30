"use client";
export const dynamic = "force-dynamic";

/**
 * World Editor Page - Dedicated full-page route for advanced maps editing.
 */

import dynamicImport from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { usePageTitle } from "~/hooks/usePageTitle";
import { MapRealmProvider } from "~/components/maps/core/MapRealmContext";
import { EditorLoadingScreen } from "~/components/maps/editor/utils/editor-overlay-helpers";

const MapEditorOverlay = dynamicImport(() => import("~/components/maps/editor/MapEditorOverlay"), {
  ssr: false,
  loading: () => <EditorLoadingScreen countryName="World Editor" />,
});

export default function WorldEditorPage() {
  usePageTitle({ title: "Admin - World Editor" });
  const router = useRouter();
  // ?realm=<slug> edits that realm's map; without it, the admin's own realm (ruling E-o)
  const realm = useSearchParams().get("realm") ?? undefined;

  return (
    <div className="bg-background text-foreground absolute inset-0 z-40">
      <MapRealmProvider value={realm}>
        <MapEditorOverlay isWorldMode={true} onExit={() => router.push("/admin/maps")} />
      </MapRealmProvider>
    </div>
  );
}
