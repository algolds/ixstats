"use client";
export const dynamic = "force-dynamic";

/**
 * Admin Maps Page - World map management dashboard.
 *
 * Heavy tabs (MapLibre-dependent) are lazy-loaded with next/dynamic
 * to prevent OOM during dev compilation of the entire dependency tree.
 */

import { useState } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "../_components/AdminHeader";
import { api } from "~/trpc/react";
import { Globe as Globe2, SystemRestart as Loader2 } from "iconoir-react";
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
      />

      {/* Summary stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="border-border/30 bg-card/25 rounded-2xl border p-3.5 shadow-xs backdrop-blur-md">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Total Features
          </p>
          {isLoading ? (
            <Skeleton className="mt-1 h-7 w-20" />
          ) : (
            <p className="text-foreground mt-1 font-mono text-xl font-bold tracking-tight">
              {stats?.totalFeatures?.toLocaleString() ?? "—"}
            </p>
          )}
        </div>

        <div className="border-border/30 bg-card/25 rounded-2xl border p-3.5 shadow-xs backdrop-blur-md">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Political Regions
          </p>
          {isLoading ? (
            <Skeleton className="mt-1 h-7 w-20" />
          ) : (
            <p className="mt-1 font-mono text-xl font-bold tracking-tight text-emerald-400">
              {stats?.politicalFeatures?.toLocaleString() ?? "—"}
            </p>
          )}
        </div>

        <div className="border-border/30 bg-card/25 rounded-2xl border p-3.5 shadow-xs backdrop-blur-md">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Linked Countries
          </p>
          {isLoading ? (
            <Skeleton className="mt-1 h-7 w-20" />
          ) : (
            <p className="mt-1 font-mono text-xl font-bold tracking-tight text-amber-400">
              {stats ? `${stats.linkedFeatures} / ${stats.totalCountries}` : "—"}
            </p>
          )}
        </div>

        <div className="border-border/30 bg-card/25 rounded-2xl border p-3.5 shadow-xs backdrop-blur-md">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Linkage Rate
          </p>
          {isLoading ? (
            <Skeleton className="mt-1 h-7 w-20" />
          ) : (
            <p className="mt-1 font-mono text-xl font-bold tracking-tight text-purple-400">
              {stats ? `${stats.linkageRate}%` : "—"}
            </p>
          )}
        </div>
      </div>

      {/* Tab navigation */}
      <div className="bg-card/40 border-border/40 flex w-full flex-wrap justify-start gap-1 rounded-xl border p-1 backdrop-blur-md sm:w-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.98] ${
              activeTab === tab.id
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="space-y-4">
        {activeTab === "pipeline" && <PipelineWizard />}
        {activeTab === "edits" && <EditQueuePanel />}
        {activeTab === "settings" && <MapSettingsTab />}
      </div>
    </div>
  );
}
