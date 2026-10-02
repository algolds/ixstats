"use client";
import { useState } from "react";
import { SystemRestart as Loader2, Palette, OpenNewWindow as ExternalLink } from "iconoir-react";
import nextDynamic from "next/dynamic";
import Link from "next/link";
import { MapStatsDashboard } from "./MapStatsDashboard";
import { Card } from "~/components/ui/card";
import { SegmentedControl } from "~/components/ui/segmented-control";

const SvgUploadManager = nextDynamic(
  () => import("./SvgUploadManager").then((m) => m.SvgUploadManager),
  {
    ssr: false,
    loading: () => (
      <div className="text-label-secondary flex items-center justify-center gap-2 py-16">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-body">Loading...</span>
      </div>
    ),
  }
);

type SubTab = "statistics" | "upload" | "style";

const SUB_TABS: { value: SubTab; label: string }[] = [
  { value: "statistics", label: "Statistics" },
  { value: "upload", label: "SVG Upload" },
  { value: "style", label: "Style Editor" },
];

export function MapSettingsTab() {
  const [subTab, setSubTab] = useState<SubTab>("statistics");

  return (
    <div className="space-y-4">
      <SegmentedControl
        options={SUB_TABS}
        value={subTab}
        onValueChange={(id) => setSubTab(id as SubTab)}
        size="md"
        className="w-full sm:w-fit"
        asTabs
      />

      {subTab === "statistics" && <MapStatsDashboard />}
      {subTab === "upload" && <SvgUploadManager />}
      {subTab === "style" && <MapStyleSettingsPanel />}
    </div>
  );
}

function MapStyleSettingsPanel() {
  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-start gap-3">
        <Palette className="text-label-secondary mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div className="flex-1 space-y-1">
          <h3 className="text-label text-headline">Visual style & theme editor</h3>
          <p className="text-label-secondary text-footnote max-w-2xl leading-relaxed">
            Atlas uses the MapLibre GL style specification to define visual layers, fonts, colors,
            and layout configurations. The embedded Maputnik style editor allows you to edit
            standard, dark, and paper styles visually and preview them with live PostGIS geographic
            boundaries.
          </p>
        </div>
      </div>

      <div className="border-separator flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-label text-caption">Launch Style Editor</div>
          <div className="text-label-secondary text-footnote">
            Visual editing is done in a full-screen canvas environment.
          </div>
        </div>
        <Link
          href="/admin/maps/style-editor"
          className="bg-tint text-on-tint rounded-row text-caption inline-flex h-8 items-center gap-2 px-4 transition-transform active:scale-[0.98]"
        >
          <span>Open Style Editor</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </Card>
  );
}
