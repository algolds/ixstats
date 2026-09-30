"use client";

import { FacetTabs } from "~/components/ui/facet";
import { FacetCard } from "~/components/ui/facet-container";
import { useState } from "react";
import { SystemRestart as Loader2, Palette, OpenNewWindow as ExternalLink } from "iconoir-react";
import nextDynamic from "next/dynamic";
import Link from "next/link";
import { MapStatsDashboard } from "./MapStatsDashboard";

const SvgUploadManager = nextDynamic(
  () => import("./SvgUploadManager").then((m) => m.SvgUploadManager),
  {
    ssr: false,
    loading: () => (
      <div className="text-muted-foreground flex items-center justify-center gap-2 py-16">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading...</span>
      </div>
    ),
  }
);

type SubTab = "statistics" | "upload" | "style";

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: "statistics", label: "Statistics" },
  { id: "upload", label: "SVG Upload" },
  { id: "style", label: "Style Editor" },
];

export function MapSettingsTab() {
  const [subTab, setSubTab] = useState<SubTab>("statistics");

  return (
    <div className="space-y-4">
      <FacetTabs
        tabs={SUB_TABS}
        activeTab={subTab}
        onChange={(id) => setSubTab(id as SubTab)}
        size="md"
        tone="accent"
        showTexture={false}
        className="w-full sm:w-fit"
      />

      {subTab === "statistics" && <MapStatsDashboard />}
      {subTab === "upload" && <SvgUploadManager />}
      {subTab === "style" && <MapStyleSettingsPanel />}
    </div>
  );
}

function MapStyleSettingsPanel() {
  return (
    <FacetCard className="space-y-4 rounded-2xl p-5">
      <div className="flex items-start gap-3">
        <Palette className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div className="flex-1 space-y-1">
          <h3 className="text-foreground text-sm font-semibold">Visual style & theme editor</h3>
          <p className="text-muted-foreground max-w-2xl text-xs leading-relaxed">
            Atlas uses the MapLibre GL style specification to define visual layers, fonts, colors,
            and layout configurations. The embedded Maputnik style editor allows you to edit
            standard, dark, and paper styles visually and preview them with live PostGIS geographic
            boundaries.
          </p>
        </div>
      </div>

      <div className="border-border/20 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-foreground text-xs font-semibold">Launch Style Editor</div>
          <div className="text-muted-foreground text-xs">
            Visual editing is done in a full-screen canvas environment.
          </div>
        </div>
        <Link
          href="/admin/maps/style-editor"
          className="bg-primary text-primary-foreground inline-flex h-8 items-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold transition-transform active:scale-[0.98]"
        >
          <span>Open Style Editor</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </FacetCard>
  );
}
