"use client";
import { useState, useSyncExternalStore } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { PageHeader } from "~/components/shell/PageHeader";
import { api } from "~/trpc/react";
import Link from "next/link";
import { SystemRestart as Loader2, EditPencil, Palette } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import nextDynamic from "next/dynamic";

// Light tabs — static imports (small bundles, no MapLibre)
import { EditQueuePanel } from "~/components/maps/editor/panels/EditQueuePanel";
import { MapSettingsTab } from "./_components/MapSettingsTab";
import { Card } from "~/components/ui/card";
import { SegmentedControl } from "~/components/ui/segmented-control";

// Heavy tabs — lazy loaded (MapLibre dependent)
const LazyLoading = () => (
  <div className="text-label-secondary flex items-center justify-center gap-2 py-16">
    <Loader2 className="h-5 w-5 animate-spin" />
    <span className="text-body">Loading...</span>
  </div>
);

const PipelineWizard = nextDynamic(
  () => import("./_components/PipelineWizard").then((m) => m.PipelineWizard),
  { ssr: false, loading: LazyLoading }
);

type TabId = "pipeline" | "edits" | "settings";

const TABS: { value: TabId; label: string }[] = [
  { value: "settings", label: "Settings" },
  { value: "pipeline", label: "Import pipeline" },
  { value: "edits", label: "Edit queue" },
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

interface AdminMapsPageProps {
  initialTab?: TabId;
}

export default function AdminMapsPage({ initialTab = "settings" }: AdminMapsPageProps = {}) {
  usePageTitle({ title: "Admin - Atlas World Map" });
  const importJob = useImportJobParam();
  const [chosenTab, setActiveTab] = useState<TabId | null>(null);
  const activeTab = chosenTab ?? (importJob ? "pipeline" : initialTab);

  const { data: stats, isLoading } = api.geoCore.getMapStats.useQuery(undefined, {
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Atlas world map"
        subtitle="Manage the IxEarth map, assign countries, coordinate PostGIS layers and review vector edits."
        actions={
          <>
            <Button asChild size="sm">
              <Link href="/admin/maps/editor">
                <EditPencil />
                Open world editor
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/maps/style-editor">
                <Palette />
                Style editor
              </Link>
            </Button>
          </>
        }
      />

      {/* Summary stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <span className="text-stat-label text-label-secondary block">Total features</span>
          {isLoading ? (
            <Skeleton className="mt-1 h-7 w-20" />
          ) : (
            <p className="text-label text-title-2 mt-1 tabular-nums">
              {stats?.totalFeatures?.toLocaleString() ?? "—"}
            </p>
          )}
        </Card>

        <Card className="p-4">
          <span className="text-stat-label text-label-secondary block">Political regions</span>
          {isLoading ? (
            <Skeleton className="mt-1 h-7 w-20" />
          ) : (
            <p className="text-title-2 text-green mt-1 tabular-nums">
              {stats?.politicalFeatures?.toLocaleString() ?? "—"}
            </p>
          )}
        </Card>

        <Card className="p-4">
          <span className="text-stat-label text-label-secondary block">Linked countries</span>
          {isLoading ? (
            <Skeleton className="mt-1 h-7 w-20" />
          ) : (
            <p className="text-title-2 text-yellow mt-1 tabular-nums">
              {stats ? `${stats.linkedFeatures} / ${stats.totalCountries}` : "—"}
            </p>
          )}
        </Card>

        <Card className="p-4">
          <span className="text-stat-label text-label-secondary block">Linkage rate</span>
          {isLoading ? (
            <Skeleton className="mt-1 h-7 w-20" />
          ) : (
            <p className="text-title-2 text-purple mt-1 tabular-nums">
              {stats ? `${stats.linkageRate}%` : "—"}
            </p>
          )}
        </Card>
      </div>

      {/* Tab navigation */}
      <SegmentedControl
        options={TABS}
        value={activeTab}
        onValueChange={(id) => setActiveTab(id as TabId)}
        size="md"
        className="w-full sm:w-fit"
        asTabs
      />

      {/* Tab content */}
      <div className="space-y-4">
        {activeTab === "pipeline" && <PipelineWizard initialJobId={importJob} />}
        {activeTab === "edits" && <EditQueuePanel />}
        {activeTab === "settings" && <MapSettingsTab />}
      </div>
    </div>
  );
}
