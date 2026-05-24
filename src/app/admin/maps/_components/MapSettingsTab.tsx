"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import nextDynamic from "next/dynamic";
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

type SubTab = "statistics" | "upload";

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: "statistics", label: "Statistics" },
  { id: "upload", label: "SVG Upload" },
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
    </div>
  );
}
