"use client";

import { useState } from "react";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { api } from "~/trpc/react";
import { Clock, FileText, FilePlus, FolderOpen, Bookmark, Hash, AlertTriangle, Layers, Info } from "lucide-react";
import { formatMWTimeAgo } from "~/lib/wiki-os/mediawiki-timestamp";
import { useFacetDepth } from "~/components/ui/facet-container";

type SandboxTab = "playground" | "recent-changes" | "stashes";

export default function WikiSandboxPage() {
  const [activeTab, setActiveTab] = useState<SandboxTab>("playground");

  return (
    <WikiOSLayout title="Kapwa Sandbox">
      <div className="kapwa-sandbox flex flex-col gap-6 p-4">
        {/* Experimental Notice styled as Kapwa Alert inside glass card */}
        <div className="kp-card p-4 flex items-start gap-3 border-amber-500/30 bg-amber-500/5 text-amber-500">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-xs">Kapwa Trial Sandbox (Experimental)</h4>
            <p className="text-[10px] mt-1 leading-relaxed opacity-80">
              This sandbox is a scoped visual integration test comparing Kapwa components and layouts in the WikiOS environment. Kapwa styling variables have been mapped to Facet glass and paper design system variables.
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 border-b border-white/10 pb-3">
          {(["playground", "recent-changes", "stashes"] as SandboxTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                activeTab === tab
                  ? "bg-[var(--wikios-accent)] text-white shadow-[0_0_10px_rgba(59,130,246,0.3)]"
                  : "text-[var(--wikios-text-muted)] hover:bg-white/5 hover:text-white"
              }`}
            >
              {tab.replace("-", " ").toUpperCase()}
            </button>
          ))}
        </div>

        {/* Tab Renderers */}
        {activeTab === "playground" && (
          <div className="flex flex-col gap-6">
            <div className="kp-card p-5 flex flex-col gap-4">
              <div className="flex items-center gap-2 mb-1">
                <Layers className="h-4 w-4 text-[var(--wikios-accent)]" />
                <h3 className="text-sm font-bold text-[var(--wikios-text)]">Component Playground</h3>
              </div>
              <p className="text-xs text-[var(--wikios-text-muted)] leading-relaxed">
                These elements are rendered using Kapwa classes, styled as volumetric glass structures, and inherit colors from the active WikiOS theme.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                {/* Buttons Showcase */}
                <div className="flex flex-col gap-3 p-4 border border-white/5 rounded bg-white/[0.01]">
                  <h4 className="text-xs font-bold text-[var(--wikios-text-muted)]">Button Presets</h4>
                  <div className="flex flex-wrap gap-3">
                    <button className="px-4 py-2 bg-[var(--color-kapwa-brand-600)] hover:bg-[var(--color-kapwa-brand-500)] text-white text-xs font-bold rounded transition-colors shadow-lg shadow-blue-500/10">
                      Primary Action
                    </button>
                    <button className="px-4 py-2 border border-[var(--color-kapwa-border-default)] text-[var(--color-kapwa-text-default)] text-xs font-bold rounded hover:bg-white/5 transition-colors">
                      Outline Action
                    </button>
                  </div>
                </div>

                {/* Status Badges */}
                <div className="flex flex-col gap-3 p-4 border border-white/5 rounded bg-white/[0.01]">
                  <h4 className="text-xs font-bold text-[var(--wikios-text-muted)]">Badges and Tags</h4>
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      Active
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Completed
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Pending
                    </span>
                  </div>
                </div>
              </div>

              {/* Scoped Alert Notice */}
              <div className="kp-card p-4 flex items-start gap-3 border-blue-500/20 bg-blue-500/5 text-blue-400 mt-2">
                <Info className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-xs">Information Notice</h4>
                  <p className="text-[10px] mt-1 leading-relaxed opacity-85">
                    This component demonstrates how the scoped Tailwind integration applies correct typography, padding, and edge-contrast borders automatically.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "recent-changes" && <RecentChangesSimulator />}

        {activeTab === "stashes" && <StashesSimulator />}
      </div>
    </WikiOSLayout>
  );
}

function RecentChangesSimulator() {
  const { data: changes, isLoading } = api.wikios.getRecentChanges.useQuery(
    { limit: 15 },
    { staleTime: 30_000 }
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[var(--wikios-accent)]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="kp-card p-5 flex flex-col gap-2">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[var(--wikios-accent)]" />
            <h3 className="text-sm font-bold text-[var(--wikios-text)]">Recent Changes Simulator</h3>
          </div>
          <span className="text-[10px] text-[var(--wikios-text-dim)]">Live tRPC query timeline</span>
        </div>

        <div className="flex flex-col gap-3">
          {changes?.map((change, idx) => {
            const diff = (change.newLen ?? 0) - (change.oldLen ?? 0);
            const diffSign = diff > 0 ? "+" : "";
            const diffClass = diff > 0 ? "text-emerald-500" : diff < 0 ? "text-red-500" : "text-muted-foreground/60";

            return (
              <div key={idx} className="flex items-start justify-between p-3 border border-white/5 rounded bg-white/[0.01] hover:bg-white/[0.03] transition-colors">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  {change.type === "new" ? (
                    <FilePlus className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                  ) : (
                    <FileText className="h-4 w-4 shrink-0 text-blue-400 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-semibold text-[var(--wikios-text)] hover:underline cursor-pointer block truncate">
                      {change.title}
                    </span>
                    <div className="flex items-center gap-1.5 mt-1 text-[10px] text-[var(--wikios-text-muted)]">
                      <span className="font-bold">{change.user}</span>
                      <span className="opacity-40">·</span>
                      <span>{formatMWTimeAgo(change.timestamp)}</span>
                    </div>
                    {change.comment && (
                      <p className="text-[10px] text-[var(--wikios-text-dim)] italic mt-1 leading-relaxed line-clamp-1">
                        "{change.comment}"
                      </p>
                    )}
                  </div>
                </div>
                <span className={`text-[10px] font-mono font-semibold shrink-0 ml-4 mt-0.5 ${diffClass}`}>
                  ({diffSign}{diff.toLocaleString()})
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StashesSimulator() {
  const { data: stashes, isLoading } = api.wikios.getStashes.useQuery();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[var(--wikios-accent)]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Bookmark className="h-4 w-4 text-[var(--wikios-accent)]" />
          <h3 className="text-sm font-bold text-[var(--wikios-text)]">Stash Manager Simulator</h3>
        </div>
        <span className="text-[10px] text-[var(--wikios-text-dim)]">Live stashes directory</span>
      </div>

      {stashes && stashes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stashes.map((stash) => (
            <StashCard key={stash.id} stash={stash} />
          ))}
        </div>
      ) : (
        <div className="kp-card p-8 flex flex-col items-center justify-center text-center gap-3">
          <FolderOpen className="h-10 w-10 text-[var(--wikios-text-dim)] opacity-20" />
          <h4 className="text-xs font-semibold text-[var(--wikios-text)]">No Stashes Found</h4>
          <p className="text-[10px] text-[var(--wikios-text-muted)] max-w-xs leading-relaxed">
            Go save some wiki pages or forum posts to load collections here.
          </p>
        </div>
      )}
    </div>
  );
}

function StashCard({ stash }: { stash: { id: string; name: string; color: string; itemCount: number } }) {
  // Dynamic Facet glass elevation hook
  const { depth, increaseDepth, resetDepth } = useFacetDepth(1);

  return (
    <div
      onMouseEnter={increaseDepth}
      onMouseLeave={resetDepth}
      className="kp-card p-4 flex flex-col gap-3 transition-transform cursor-pointer"
      style={{
        transform: depth > 1 ? "translateY(-2px)" : "none",
        borderColor: stash.color ? `${stash.color}33` : "var(--wikios-border)"
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ background: stash.color || "var(--wikios-accent)" }}
          />
          <span className="text-xs font-bold text-[var(--wikios-text)] truncate">{stash.name}</span>
        </div>
        <span className="text-[10px] text-[var(--wikios-text-muted)] flex items-center gap-0.5 shrink-0 ml-3">
          <Hash className="h-3 w-3" /> {stash.itemCount} items
        </span>
      </div>
      <p className="text-[10px] text-[var(--wikios-text-dim)] leading-relaxed">
        Scoped collection. Hovering over this card activates Facet dynamic elevation spring transitions.
      </p>
    </div>
  );
}
