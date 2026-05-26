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
import { Globe2, Loader2 } from "lucide-react";
import { Skeleton } from "~/components/ui/skeleton";
import nextDynamic from "next/dynamic";

// Light tabs — static imports (small bundles, no MapLibre)
import { CountryLinkageTab } from "./_components/CountryLinkageTab";
import { EditQueuePanel } from "./_components/EditQueuePanel";
import { MapSettingsTab } from "./_components/MapSettingsTab";
import { SovereigntyManager } from "./_components/SovereigntyManager";

// Heavy tabs — lazy loaded (MapLibre + procedural generation)
const LazyLoading = () => (
  <div className="text-muted-foreground flex items-center justify-center gap-2 py-16">
    <Loader2 className="h-5 w-5 animate-spin" />
    <span className="text-sm">Loading...</span>
  </div>
);

const WorldMapManager = nextDynamic(
  () => import("./_components/WorldMapManager").then((m) => m.WorldMapManager),
  { ssr: false, loading: LazyLoading }
);
const BorderEditorTab = nextDynamic(
  () => import("./_components/BorderEditorTab").then((m) => m.BorderEditorTab),
  { ssr: false, loading: LazyLoading }
);
const TemplateManager = nextDynamic(
  () => import("./_components/TemplateManager").then((m) => m.TemplateManager),
  { ssr: false, loading: LazyLoading }
);
const WorldGeneratorTab = nextDynamic(
  () => import("./_components/WorldGeneratorTab").then((m) => m.WorldGeneratorTab),
  { ssr: false, loading: LazyLoading }
);
const PipelineWizard = nextDynamic(
  () => import("./_components/PipelineWizard").then((m) => m.PipelineWizard),
  { ssr: false, loading: LazyLoading }
);
const ForgeTab = nextDynamic(() => import("./_components/ForgeTab").then((m) => m.ForgeTab), {
  ssr: false,
  loading: LazyLoading,
});

type TabId =
  | "forge"
  | "pipeline"
  | "map"
  | "countries"
  | "sovereignty"
  | "edits"
  | "border-editor"
  | "templates"
  | "generator"
  | "settings";

const TABS: { id: TabId; label: string }[] = [
  { id: "forge", label: "Forge" },
  { id: "pipeline", label: "Import Pipeline" },
  { id: "map", label: "World Map" },
  { id: "countries", label: "Countries" },
  { id: "sovereignty", label: "Sovereignty" },
  { id: "edits", label: "Edit Queue" },
  { id: "border-editor", label: "Border Editor" },
  { id: "templates", label: "Templates" },
  { id: "generator", label: "World Generator" },
  { id: "settings", label: "Settings" },
];

export default function AdminMapsPage() {
  usePageTitle({ title: "Admin - World Map" });
  const [activeTab, setActiveTab] = useState<TabId>("pipeline");

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
      {activeTab === "forge" && <ForgeTab />}
      {activeTab === "pipeline" && <PipelineWizard />}
      {activeTab === "map" && <WorldMapManager />}
      {activeTab === "countries" && <CountryLinkageTab />}
      {activeTab === "sovereignty" && <SovereigntyManager />}
      {activeTab === "edits" && <EditQueuePanel />}
      {activeTab === "border-editor" && <BorderEditorTab />}
      {activeTab === "templates" && <TemplateManager />}
      {activeTab === "generator" && <WorldGeneratorTab />}
      {activeTab === "settings" && <MapSettingsTab />}
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
