"use client";

import { useState } from "react";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { api } from "~/trpc/react";
import {
  Clock,
  FileText,
  FilePlus,
  FolderOpen,
  Bookmark,
  Hash,
  AlertTriangle,
  Layers,
  Info,
} from "lucide-react";
import { formatMWTimeAgo } from "~/lib/wiki-os/mediawiki-timestamp";
import { useFacetDepth } from "~/components/ui/facet-container";

type SandboxTab = "playground" | "recent-changes" | "stashes";

export default function WikiSandboxPage() {
  const [activeTab, setActiveTab] = useState<SandboxTab>("playground");

  return (
    <WikiOSLayout title="Kapwa Sandbox">
      <div className="kapwa-sandbox flex flex-col gap-6 p-4">
        {/* Experimental Notice styled as Kapwa Alert inside glass card */}
        <div className="kp-card flex items-start gap-3 border-amber-500/30 bg-amber-500/5 p-4 text-amber-700 dark:text-amber-500">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h4 className="text-xs font-bold">Kapwa Trial Sandbox (Experimental)</h4>
            <p className="mt-1 text-[10px] leading-relaxed opacity-80">
              This sandbox is a scoped visual integration test comparing Kapwa components and
              layouts in the WikiOS environment. Kapwa styling variables have been mapped to Facet
              glass and paper design system variables.
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 border-b border-[var(--wikios-border)] pb-3">
          {(["playground", "recent-changes", "stashes"] as SandboxTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === tab
                  ? "bg-[var(--wikios-accent)] text-white shadow-[0_0_10px_rgba(59,130,246,0.3)]"
                  : "text-[var(--wikios-text-muted)] hover:bg-black/5 hover:text-[var(--wikios-text)] dark:hover:bg-white/5"
              }`}
            >
              {tab.replace("-", " ").toUpperCase()}
            </button>
          ))}
        </div>

        {/* Tab Renderers */}
        {activeTab === "playground" && (
          <div className="flex flex-col gap-6">
            <div className="kp-card flex flex-col gap-4 p-5">
              <div className="mb-1 flex items-center gap-2">
                <Layers className="h-4 w-4 text-[var(--wikios-accent)]" />
                <h3 className="text-sm font-bold text-[var(--wikios-text)]">
                  Component Playground
                </h3>
              </div>
              <p className="text-xs leading-relaxed text-[var(--wikios-text-muted)]">
                These elements are rendered using Kapwa classes, styled as volumetric glass
                structures, and inherit colors from the active WikiOS theme.
              </p>

              <div className="mt-2 grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Buttons Showcase */}
                <div className="flex flex-col gap-3 rounded border border-[var(--wikios-border)] bg-black/[0.01] p-4 dark:bg-white/[0.01]">
                  <h4 className="text-xs font-bold text-[var(--wikios-text-muted)]">
                    Button Presets
                  </h4>
                  <div className="flex flex-wrap gap-3">
                    <button className="rounded bg-[var(--color-kapwa-brand-600)] px-4 py-2 text-xs font-bold text-white shadow-lg shadow-blue-500/10 transition-colors hover:bg-[var(--color-kapwa-brand-500)]">
                      Primary Action
                    </button>
                    <button className="rounded border border-[var(--color-kapwa-border-default)] px-4 py-2 text-xs font-bold text-[var(--color-kapwa-text-default)] transition-colors hover:bg-black/5 dark:hover:bg-white/5">
                      Outline Action
                    </button>
                  </div>
                </div>

                {/* Status Badges */}
                <div className="flex flex-col gap-3 rounded border border-[var(--wikios-border)] bg-black/[0.01] p-4 dark:bg-white/[0.01]">
                  <h4 className="text-xs font-bold text-[var(--wikios-text-muted)]">
                    Badges and Tags
                  </h4>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-400">
                      Active
                    </span>
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                      Completed
                    </span>
                    <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                      Pending
                    </span>
                  </div>
                </div>
              </div>

              {/* Scoped Alert Notice */}
              <div className="kp-card mt-2 flex items-start gap-3 border-blue-500/20 bg-blue-500/5 p-4 text-blue-600 dark:text-blue-400">
                <Info className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold">Information Notice</h4>
                  <p className="mt-1 text-[10px] leading-relaxed opacity-85">
                    This component demonstrates how the scoped Tailwind integration applies correct
                    typography, padding, and edge-contrast borders automatically.
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
      <div className="flex items-center justify-center py-12">
        <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-[var(--wikios-accent)]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="kp-card flex flex-col gap-2 p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[var(--wikios-accent)]" />
            <h3 className="text-sm font-bold text-[var(--wikios-text)]">
              Recent Changes Simulator
            </h3>
          </div>
          <span className="text-[10px] text-[var(--wikios-text-dim)]">
            Live tRPC query timeline
          </span>
        </div>

        <div className="flex flex-col gap-3">
          {changes?.map((change, idx) => {
            const diff = (change.newLen ?? 0) - (change.oldLen ?? 0);
            const diffSign = diff > 0 ? "+" : "";
            const diffClass =
              diff > 0
                ? "text-emerald-500"
                : diff < 0
                  ? "text-red-500"
                  : "text-muted-foreground/60";

            return (
              <div
                key={idx}
                className="flex items-start justify-between rounded border border-[var(--wikios-border)] bg-black/[0.01] p-3 transition-colors hover:bg-black/[0.03] dark:bg-white/[0.01] dark:hover:bg-white/[0.03]"
              >
                <div className="flex min-w-0 flex-1 items-start gap-2.5">
                  {change.type === "new" ? (
                    <FilePlus className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  ) : (
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="block cursor-pointer truncate text-xs font-semibold text-[var(--wikios-text)] hover:underline">
                      {change.title}
                    </span>
                    <div className="mt-1 flex items-center gap-1.5 text-[10px] text-[var(--wikios-text-muted)]">
                      <span className="font-bold">{change.user}</span>
                      <span className="opacity-40">·</span>
                      <span>{formatMWTimeAgo(change.timestamp)}</span>
                    </div>
                    {change.comment && (
                      <p className="mt-1 line-clamp-1 text-[10px] leading-relaxed text-[var(--wikios-text-dim)] italic">
                        "{change.comment}"
                      </p>
                    )}
                  </div>
                </div>
                <span
                  className={`mt-0.5 ml-4 shrink-0 font-mono text-[10px] font-semibold ${diffClass}`}
                >
                  ({diffSign}
                  {diff.toLocaleString()})
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
      <div className="flex items-center justify-center py-12">
        <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-[var(--wikios-accent)]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bookmark className="h-4 w-4 text-[var(--wikios-accent)]" />
          <h3 className="text-sm font-bold text-[var(--wikios-text)]">Stash Manager Simulator</h3>
        </div>
        <span className="text-[10px] text-[var(--wikios-text-dim)]">Live stashes directory</span>
      </div>

      {stashes && stashes.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {stashes.map((stash) => (
            <StashCard key={stash.id} stash={stash} />
          ))}
        </div>
      ) : (
        <div className="kp-card flex flex-col items-center justify-center gap-3 p-8 text-center">
          <FolderOpen className="h-10 w-10 text-[var(--wikios-text-dim)] opacity-20" />
          <h4 className="text-xs font-semibold text-[var(--wikios-text)]">No Stashes Found</h4>
          <p className="max-w-xs text-[10px] leading-relaxed text-[var(--wikios-text-muted)]">
            Go save some wiki pages or forum posts to load collections here.
          </p>
        </div>
      )}
    </div>
  );
}

function StashCard({
  stash,
}: {
  stash: { id: string; name: string; color: string; itemCount: number };
}) {
  // Dynamic Facet glass elevation hook
  const { depth, increaseDepth, resetDepth } = useFacetDepth(1);

  return (
    <div
      onMouseEnter={increaseDepth}
      onMouseLeave={resetDepth}
      className="kp-card flex cursor-pointer flex-col gap-3 p-4 transition-transform"
      style={{
        transform: depth > 1 ? "translateY(-2px)" : "none",
        borderColor: stash.color ? `${stash.color}33` : "var(--wikios-border)",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: stash.color || "var(--wikios-accent)" }}
          />
          <span className="truncate text-xs font-bold text-[var(--wikios-text)]">{stash.name}</span>
        </div>
        <span className="ml-3 flex shrink-0 items-center gap-0.5 text-[10px] text-[var(--wikios-text-muted)]">
          <Hash className="h-3 w-3" /> {stash.itemCount} items
        </span>
      </div>
      <p className="text-[10px] leading-relaxed text-[var(--wikios-text-dim)]">
        Scoped collection. Hovering over this card activates Facet dynamic elevation spring
        transitions.
      </p>
    </div>
  );
}
