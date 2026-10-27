"use client";

import nextDynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import { ManageSection } from "./ManageSection";

const RealmMapImportWizard = nextDynamic(
  () =>
    import("~/app/admin/maps/_components/map-import/RealmMapImportWizard").then(
      (m) => m.RealmMapImportWizard
    ),
  { ssr: false, loading: () => <p className="text-label-secondary text-footnote">Loading…</p> }
);

const noSubscribe = () => () => undefined;

/** `?mapImportJob=<id>`: an import started from the realm's wiki panel ("Import this map"). */
function useMapImportJobParam(): string | null {
  return useSyncExternalStore(
    noSubscribe,
    () => new URLSearchParams(window.location.search).get("mapImportJob"),
    () => null
  );
}

/**
 * Map import (founder and officers with the Map power): the realm's political map from a flat-colour image, an
 * SVG or GeoJSON, analysed in the background, matched to the realm's nations, dry-run, applied, and rolled back
 * when needed.
 */
export function MapImportSection({ realmId }: { realmId: string }) {
  const initialJobId = useMapImportJobParam();
  return (
    <ManageSection
      id="map-import"
      title="Map import"
      description="Bring the realm's borders in from a flat-colour map image, an SVG or GeoJSON. Nothing is written until you review the changes and apply them, and an applied import can be rolled back."
    >
      <RealmMapImportWizard realmId={realmId} initialJobId={initialJobId} />
    </ManageSection>
  );
}
