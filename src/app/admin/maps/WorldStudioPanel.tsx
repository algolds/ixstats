"use client";
export const dynamic = "force-dynamic";

/**
 * Admin Maps Page - World map management dashboard.
 *
 * Heavy tabs (MapLibre-dependent) are lazy-loaded with next/dynamic
 * to prevent OOM during dev compilation of the entire dependency tree.
 */

import { FacetTabs } from "~/components/ui/facet";
import { FacetCard } from "~/components/ui/facet-container";
import { Eyebrow } from "~/components/ui/eyebrow";
import { useState } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "../_components/AdminHeader";
import { api } from "~/trpc/react";
import Link from "next/link";
import { Globe as Globe2, SystemRestart as Loader2, EditPencil, Palette } from "iconoir-react";
import { Skeleton } from "~/components/ui/skeleton";
import nextDynamic from "next/dynamic";

// Light tabs — static imports (small bundles, no MapLibre)
import { EditQueuePanel } from "./_components/EditQueuePanel";
import { MapSettingsTab } from "./_components/MapSettingsTab";

// Heavy tabs — lazy loaded (MapLibre dependent)
const LazyLoading = () => (
  <div className="text-muted-foreground flex items-center justify-center gap-2 py-16">
    <Loader2 className="h-5 w-5 animate-spin" />
    <span className="text-sm">Loading...</span>
  </div>
);

const PipelineWizard = nextDynamic(
  () => import("./_components/PipelineWizard").then((m) => m.PipelineWizard),
  { ssr: false, loading: LazyLoading }
);

type TabId = "pipeline" | "edits" | "settings";

const TABS: { id: TabId; label: string }[] = [
  { id: "settings", label: "Settings" },
  { id: "pipeline", label: "Import Pipeline" },
  { id: "edits", label: "Edit Queue" },
];

interface AdminMapsPageProps {
  initialTab?: TabId;
}

export default function AdminMapsPage({ initialTab = "settings" }: AdminMapsPageProps = {}) {
  usePageTitle({ title: "Admin - Atlas World Map" });
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  const { data: stats, isLoading } = api.geoCore.getMapStats.useQuery(undefined, {
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={Globe2}
        title="Atlas World Map"
        description="Manage the IxEarth map, assign countries, coordinate PostGIS layers, and review vector edits."
      >
        <Link
          href="/admin/maps/editor"
          className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-xs transition-[background-color,transform] active:scale-[0.98]"
        >
          <EditPencil className="h-3.5 w-3.5" />
          Open World Editor
        </Link>
        <Link
          href="/admin/maps/style-editor"
          className="border-border text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-[background-color,color,transform] active:scale-[0.98]"
        >
          <Palette className="h-3.5 w-3.5" />
          Style Editor
        </Link>
      </AdminHeader>

      {/* Summary stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <FacetCard className="rounded-2xl p-3.5">
          <Eyebrow className="block">Total Features</Eyebrow>
          {isLoading ? (
            <Skeleton className="mt-1 h-7 w-20" />
          ) : (
            <p className="text-foreground mt-1 font-mono text-xl font-bold tracking-tight">
              {stats?.totalFeatures?.toLocaleString() ?? "—"}
            </p>
          )}
        </FacetCard>

        <FacetCard className="rounded-2xl p-3.5">
          <Eyebrow className="block">Political Regions</Eyebrow>
          {isLoading ? (
            <Skeleton className="mt-1 h-7 w-20" />
          ) : (
            <p className="mt-1 font-mono text-xl font-bold tracking-tight text-emerald-400">
              {stats?.politicalFeatures?.toLocaleString() ?? "—"}
            </p>
          )}
        </FacetCard>

        <FacetCard className="rounded-2xl p-3.5">
          <Eyebrow className="block">Linked Countries</Eyebrow>
          {isLoading ? (
            <Skeleton className="mt-1 h-7 w-20" />
          ) : (
            <p className="mt-1 font-mono text-xl font-bold tracking-tight text-amber-400">
              {stats ? `${stats.linkedFeatures} / ${stats.totalCountries}` : "—"}
            </p>
          )}
        </FacetCard>

        <FacetCard className="rounded-2xl p-3.5">
          <Eyebrow className="block">Linkage Rate</Eyebrow>
          {isLoading ? (
            <Skeleton className="mt-1 h-7 w-20" />
          ) : (
            <p className="mt-1 font-mono text-xl font-bold tracking-tight text-purple-400">
              {stats ? `${stats.linkageRate}%` : "—"}
            </p>
          )}
        </FacetCard>
      </div>

      {/* Tab navigation */}
      <FacetTabs
        tabs={TABS}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as TabId)}
        size="md"
        tone="accent"
        showTexture={false}
        className="w-full sm:w-fit"
      />

      {/* Tab content */}
      <div className="space-y-4">
        {activeTab === "pipeline" && <PipelineWizard />}
        {activeTab === "edits" && <EditQueuePanel />}
        {activeTab === "settings" && <MapSettingsTab />}
      </div>
    </div>
  );
}
