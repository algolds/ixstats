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
import { Button } from "~/components/ui/button";
import { Toggle } from "~/components/ui/toggle";
import {
  DIRECTIVE_DOMAINS,
  filterPresets,
  type DirectiveDomain,
  type DirectivePreset,
} from "./directive-presets";
import { Card } from "~/components/ui/card";

const DOMAIN_ICONS: Record<DirectiveDomain, React.ComponentType<{ className?: string }>> = {
  Economy: GraphUp,
  Fiscal: Coins,
  Social: Heart,
  Infrastructure: Train,
  Security: ShieldCheck,
  Defense: Shield,
  Diplomacy: Globe,
  Governance: Bank,
};

/** Presets per domain in the unsearched All view; the rest are one domain filter away. */
const ALL_VIEW_PREVIEW = 3;

interface DirectivePresetsCatalogProps {
  /** Free-text filter from the goal field. */
  query: string;
  onSelectGoal: (goal: string) => void;
  /** Domain to open on (e.g. the one "Suggest one" picked). */
  domain?: DirectiveDomain | "All";
  onDomainChange?: (domain: DirectiveDomain | "All") => void;
}

/** Step 1 browser: domain filter toggles and the matching presets, grouped by domain. */
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

  const previewOnly = domain === "All" && !query.trim();
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
          const count = d === "All" ? totalMatches : (counts.get(d) ?? 0);
          return (
            <Toggle
              key={d}
              variant="outline"
              size="sm"
              pressed={domain === d}
              onPressedChange={() => setDomain(d)}
              className="shrink-0 gap-2 rounded-full px-3 max-sm:h-11"
            >
              <span>{d}</span>
              <span className="text-label-secondary tabular-nums">{count}</span>
            </Toggle>
          );
        })}
      </div>

      {groups.length === 0 ? (
        <Card variant="well" padding="none" className="px-4 py-8 text-center">
          <p className="text-label text-body font-medium">No presets match</p>
          <p className="text-label-secondary text-footnote mt-1">
            {query.trim()
              ? "Use your own wording as a custom goal, or clear the search."
              : "Try another domain."}
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map(({ domain: d, presets }) => {
            const Icon = DOMAIN_ICONS[d];
            const shown = previewOnly ? presets.slice(0, ALL_VIEW_PREVIEW) : presets;
            return (
              <section key={d} aria-label={`${d} presets`} className="space-y-2">
                <h4 className="text-label text-subhead flex items-center gap-2 px-1 font-semibold">
                  <Icon className="text-tint h-4 w-4" aria-hidden />
                  {d}
                </h4>
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {shown.map((p) => (
                    <li key={p.label}>
                      <Button
                        variant="outline"
                        onClick={() => onSelectGoal(p.label)}
                        className="rounded-row h-full min-h-11 w-full justify-start gap-3 px-3 py-3 text-left whitespace-normal"
                      >
                        <span className="text-label text-body min-w-0 flex-1 leading-snug font-medium">
                          {p.label}
                        </span>
                        <NavArrowRight className="text-label-tertiary" aria-hidden />
                      </Button>
                    </li>
                  ))}
                </ul>
                {shown.length < presets.length && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDomain(d)}
                    className="text-label-secondary max-sm:h-11"
                  >
                    Show all {presets.length} {d} presets
                    <NavArrowRight aria-hidden />
                  </Button>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
});
