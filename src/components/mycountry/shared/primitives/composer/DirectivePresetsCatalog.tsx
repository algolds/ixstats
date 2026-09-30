"use client";

import React, { useMemo, useState } from "react";
import {
  Bank,
  Coins,
  Globe,
  GraphUp,
  Heart,
  NavArrowRight,
  Shield,
  ShieldCheck,
  Train,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import {
  DIRECTIVE_DOMAINS,
  filterPresets,
  type DirectiveDomain,
  type DirectivePreset,
} from "./directive-presets";

export const DOMAIN_ICONS: Record<DirectiveDomain, React.ComponentType<{ className?: string }>> = {
  Economy: GraphUp,
  Fiscal: Coins,
  Social: Heart,
  Infrastructure: Train,
  Security: ShieldCheck,
  Defense: Shield,
  Diplomacy: Globe,
  Governance: Bank,
};

export interface DirectivePresetsCatalogProps {
  /** Free-text filter from the goal field. */
  query: string;
  onSelectGoal: (goal: string) => void;
  /** Domain to open on (e.g. the one "Suggest one" picked). */
  domain?: DirectiveDomain | "All";
  onDomainChange?: (domain: DirectiveDomain | "All") => void;
}

/** Step 1 browser: domain filter chips and the matching presets, grouped by domain. */
export const DirectivePresetsCatalog = React.memo(function DirectivePresetsCatalog({
  query,
  onSelectGoal,
  domain: controlledDomain,
  onDomainChange,
}: DirectivePresetsCatalogProps) {
  const [localDomain, setLocalDomain] = useState<DirectiveDomain | "All">("All");
  const domain = controlledDomain ?? localDomain;
  const setDomain = (d: DirectiveDomain | "All") => {
    setLocalDomain(d);
    onDomainChange?.(d);
  };

  const matches = useMemo(() => filterPresets(domain, query), [domain, query]);
  const counts = useMemo(() => {
    const byDomain = new Map<string, number>();
    for (const p of filterPresets("All", query)) {
      byDomain.set(p.domain, (byDomain.get(p.domain) ?? 0) + 1);
    }
    return byDomain;
  }, [query]);
  const totalMatches = useMemo(
    () => Array.from(counts.values()).reduce((sum, n) => sum + n, 0),
    [counts]
  );

  const groups = useMemo(() => {
    const byDomain = new Map<DirectiveDomain, DirectivePreset[]>();
    for (const p of matches) {
      const list = byDomain.get(p.domain) ?? [];
      list.push(p);
      byDomain.set(p.domain, list);
    }
    return DIRECTIVE_DOMAINS.filter((d) => byDomain.has(d)).map((d) => ({
      domain: d,
      presets: byDomain.get(d)!,
    }));
  }, [matches]);

  return (
    <div className="space-y-4">
      {/* Domain filter: scrolls sideways on phones instead of wrapping into a wall of chips */}
      <div
        role="group"
        aria-label="Filter presets by domain"
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
      >
        {(["All", ...DIRECTIVE_DOMAINS] as const).map((d) => {
          const active = domain === d;
          const count = d === "All" ? totalMatches : (counts.get(d) ?? 0);
          return (
            <button
              key={d}
              type="button"
              aria-pressed={active}
              onClick={() => setDomain(d)}
              data-cuelume-press="tick"
              className={cn(
                "focus-visible:ring-ring inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-[color,background-color,border-color,transform] duration-150 outline-none focus-visible:ring-2 active:scale-[0.97]",
                active
                  ? "border-foreground/20 bg-foreground text-background"
                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              <span>{d}</span>
              <span className={cn("tabular-nums", active ? "opacity-70" : "opacity-60")}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {groups.length === 0 ? (
        <div className="border-border bg-muted/30 rounded-2xl border border-dashed px-4 py-8 text-center">
          <p className="text-foreground text-sm font-medium">No presets match</p>
          <p className="text-muted-foreground mt-1 text-xs">
            {query.trim()
              ? "Use your own wording as a custom goal, or clear the search."
              : "Try another domain."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(({ domain: d, presets }) => {
            const Icon = DOMAIN_ICONS[d];
            return (
              <section key={d} aria-label={`${d} presets`} className="space-y-2">
                <h4 className="text-muted-foreground flex items-center gap-2 px-1 text-xs font-semibold tracking-wide uppercase">
                  <Icon className="h-3.5 w-3.5" />
                  {d}
                </h4>
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {presets.map((p) => (
                    <li key={p.label}>
                      <button
                        type="button"
                        onClick={() => onSelectGoal(p.label)}
                        data-cuelume-press="press"
                        className="group border-border bg-card hover:bg-muted/40 focus-visible:ring-ring flex h-full w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-[color,background-color,border-color,transform] duration-150 outline-none hover:border-amber-500/40 focus-visible:ring-2 active:scale-[0.98]"
                      >
                        <span className="bg-muted text-muted-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors group-hover:text-amber-600 dark:group-hover:text-amber-400">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="text-foreground min-w-0 flex-1 text-sm leading-snug font-medium">
                          {p.label}
                        </span>
                        <NavArrowRight className="text-muted-foreground/60 h-4 w-4 shrink-0" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
});
