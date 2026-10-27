"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Planet, Upload } from "iconoir-react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { PageHeader } from "~/components/shell/PageHeader";
import { Button } from "~/components/ui/button";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { EditQueuePanel } from "~/components/maps/editor/panels/EditQueuePanel";
import { AtlasHealthStrip, type AtlasTab } from "./AtlasHealthStrip";
import { AtlasImportPanel } from "./AtlasImportPanel";
import { ImportLauncherContext } from "./import-launcher";
import { AtlasJobsTab } from "./AtlasJobsTab";
import { AtlasRealmsTab } from "./AtlasRealmsTab";
import { AtlasStyleTab } from "./AtlasStyleTab";

const TABS: Array<{ value: AtlasTab; label: string }> = [
  { value: "realms", label: "Realms" },
  { value: "jobs", label: "Jobs" },
  { value: "edits", label: "Edit queue" },
  { value: "style", label: "Map style" },
];

const noSubscribe = () => () => undefined;

/** `?importJob=<id>`: a map import started elsewhere ("Import this map" on a realm's wiki), opened in the wizard. */
function useImportJobParam(): string | null {
  return useSyncExternalStore(
    noSubscribe,
    () => new URLSearchParams(window.location.search).get("importJob"),
    () => null
  );
}

/** Atlas: the admin home for every realm's map. A health strip, then Realms, Jobs, Edit queue and Map style. */
export function AtlasPanel() {
  usePageTitle({ title: "Admin - Atlas" });
  const importJob = useImportJobParam();
  const [tab, setTab] = useState<AtlasTab>("realms");
  // null: follow `?importJob`; otherwise what the admin chose (the button, a retry that started an analysis, Close)
  const [importChoice, setImportChoice] = useState<{ open: boolean; job: string | null } | null>(
    null
  );
  const importOpen = importChoice ? importChoice.open : importJob !== null;
  const wizardJob = importChoice ? importChoice.job : importJob;

  return (
    <ImportLauncherContext.Provider value={(job) => setImportChoice({ open: true, job })}>
      <div className="space-y-6">
        <PageHeader
          title="Atlas"
          subtitle="Every realm's map: layers, relief, linkage, jobs and the edit queue."
          actions={
            <>
              <Button asChild size="sm" variant="outline">
                <Link href="/admin/maps/studio">
                  <Planet />
                  World Studio
                </Link>
              </Button>
              <Button size="sm" onClick={() => setImportChoice({ open: true, job: null })}>
                <Upload />
                Import a map
              </Button>
            </>
          }
        />

        <AtlasHealthStrip onOpenTab={setTab} />

        {importOpen && (
          <AtlasImportPanel
            key={wizardJob ?? "new"}
            initialJobId={wizardJob}
            onClose={() => setImportChoice({ open: false, job: null })}
          />
        )}

        <SegmentedControl
          asTabs
          aria-label="Atlas sections"
          options={TABS}
          value={tab}
          onValueChange={setTab}
          size="md"
          className="w-full sm:w-fit"
        />

        <div className="space-y-4">
          {tab === "realms" && <AtlasRealmsTab />}
          {tab === "jobs" && <AtlasJobsTab />}
          {tab === "edits" && <EditQueuePanel />}
          {tab === "style" && <AtlasStyleTab />}
        </div>
      </div>
    </ImportLauncherContext.Provider>
  );
}
