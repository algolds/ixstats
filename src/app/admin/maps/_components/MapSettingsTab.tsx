"use client";

import { useState } from "react";
import { Loader2, Palette, ExternalLink } from "lucide-react";
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
      <div className="flex gap-2">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              subTab === tab.id
                ? "bg-blue-500/20 text-blue-400"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground/80"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {subTab === "statistics" && <MapStatsDashboard />}
      {subTab === "upload" && <SvgUploadManager />}
      {subTab === "style" && <MapStyleSettingsPanel />}
    </div>
  );
}

function MapStyleSettingsPanel() {
  return (
    <div className="space-y-6">
      <div className="border-border bg-card rounded-xl border p-6">
        <div className="flex items-start gap-4">
          <div className="bg-blue-500/10 text-blue-500 rounded-lg p-3">
            <Palette className="h-6 w-6" />
          </div>
          <div className="flex-1 space-y-1">
            <h3 className="text-foreground text-lg font-semibold">Visual Style & Theme Editor</h3>
            <p className="text-muted-foreground text-sm max-w-2xl">
              IxStats uses the MapLibre GL style specification to define visual layers, fonts, colors, and layout configurations. 
              The embedded Maputnik style editor allows you to edit standard, dark, and paper styles visually and preview them with live PostGIS geographic boundaries.
            </p>
          </div>
        </div>

        <div className="border-border/60 mt-6 border-t pt-6 flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-sm font-medium text-foreground">Launch Style Editor</div>
            <div className="text-muted-foreground text-xs">Visual editing is done in a full-screen environment.</div>
          </div>
          <Link
            href="/admin/maps/style-editor"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <span>Open Style Editor</span>
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
