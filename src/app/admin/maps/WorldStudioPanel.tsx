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
import { Globe2, Loader2, Palette, ExternalLink } from "lucide-react";
import { Skeleton } from "~/components/ui/skeleton";
import nextDynamic from "next/dynamic";
import Link from "next/link";

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

type TabId = "pipeline" | "edits" | "settings" | "style-editor";

const TABS: { id: TabId; label: string }[] = [
  { id: "settings", label: "Settings" },
  { id: "style-editor", label: "Style Editor" },
  { id: "pipeline", label: "Import Pipeline" },
  { id: "edits", label: "Edit Queue" },
];

export default function AdminMapsPage() {
  usePageTitle({ title: "Admin - World Map" });
  const [activeTab, setActiveTab] = useState<TabId>("settings");

  const { data: stats, isLoading } = api.geoCore.getMapStats.useQuery(undefined, {
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={Globe2}
        title="World Map"
        description="Manage the IxEarth map, assign countries, and review edits"
      />

      {/* Summary stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard
          label="Total Features"
          value={stats?.totalFeatures}
          isLoading={isLoading}
          color="blue"
        />
        <StatCard
          label="Political Regions"
          value={stats?.politicalFeatures}
          isLoading={isLoading}
          color="emerald"
        />
        <StatCard
          label="Linked Countries"
          value={stats ? `${stats.linkedFeatures} / ${stats.totalCountries}` : undefined}
          isLoading={isLoading}
          color="amber"
        />
        <StatCard
          label="Linkage Rate"
          value={stats ? `${stats.linkageRate}%` : undefined}
          isLoading={isLoading}
          color="purple"
        />
      </div>

      {/* Tab navigation */}
      <div className="border-border border-b">
        <nav className="-mb-px flex gap-4 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 px-1 pb-3 text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-500"
                  : "text-muted-foreground hover:border-border hover:text-foreground border-transparent"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === "pipeline" && <PipelineWizard />}
      {activeTab === "edits" && <EditQueuePanel />}
      {activeTab === "settings" && <MapSettingsTab />}
      {activeTab === "style-editor" && <MapStyleSettingsPanel />}
    </div>
  );
}

function MapStyleSettingsPanel() {
  return (
    <div className="space-y-6">
      <div className="border-border bg-card rounded-xl border p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-blue-500/10 p-3 text-blue-500">
            <Palette className="h-6 w-6" />
          </div>
          <div className="flex-1 space-y-1">
            <h3 className="text-foreground text-lg font-semibold">Visual Style & Theme Editor</h3>
            <p className="text-muted-foreground max-w-2xl text-sm">
              IxStats uses the MapLibre GL style specification to define visual layers, fonts,
              colors, and layout configurations. The embedded Maputnik style editor allows you to
              edit standard, dark, and paper styles visually and preview them with live PostGIS
              geographic boundaries.
            </p>
          </div>
        </div>

        <div className="border-border/60 mt-6 flex items-center justify-between border-t pt-6">
          <div className="space-y-1">
            <div className="text-foreground text-sm font-medium">Launch Style Editor</div>
            <div className="text-muted-foreground text-xs">
              Visual editing is done in a full-screen environment.
            </div>
          </div>
          <Link
            href="/admin/maps/style-editor"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
          >
            <span>Open Style Editor</span>
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  isLoading,
  color,
}: {
  label: string;
  value: string | number | undefined;
  isLoading: boolean;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "border-blue-500/20 from-blue-500/10 to-blue-600/5",
    emerald: "border-emerald-500/20 from-emerald-500/10 to-emerald-600/5",
    amber: "border-amber-500/20 from-amber-500/10 to-amber-600/5",
    purple: "border-purple-500/20 from-purple-500/10 to-purple-600/5",
  };

  return (
    <div className={`rounded-xl border bg-gradient-to-br p-4 ${colorMap[color] || colorMap.blue}`}>
      <span className="text-muted-foreground text-xs font-medium uppercase">{label}</span>
      {isLoading ? (
        <Skeleton className="mt-1 h-8 w-20" />
      ) : (
        <div className="text-foreground mt-1 text-2xl font-bold">{value ?? "—"}</div>
      )}
    </div>
  );
}
