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
import { Eyebrow } from "~/components/ui/eyebrow";
import { FacetContainer } from "~/components/ui/facet-container";
import { Toggle } from "~/components/ui/toggle";
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
              className="shrink-0 gap-1.5 rounded-full px-3 text-xs font-semibold max-sm:h-11"
            >
              <span>{d}</span>
              <span className="tabular-nums opacity-60">{count}</span>
            </Toggle>
          );
        })}
      </div>

      {groups.length === 0 ? (
        <FacetContainer depth={3} surface="solid" className="rounded-xl px-4 py-8 text-center">
          <p className="text-foreground text-sm font-medium">No presets match</p>
          <p className="text-muted-foreground mt-1 text-xs">
            {query.trim()
              ? "Use your own wording as a custom goal, or clear the search."
              : "Try another domain."}
          </p>
        </FacetContainer>
      ) : (
        <div className="space-y-6">
          {groups.map(({ domain: d, presets }) => {
            const Icon = DOMAIN_ICONS[d];
            return (
              <section key={d} aria-label={`${d} presets`} className="space-y-2">
                <h4 className="flex items-center gap-2 px-1">
                  <Icon className="text-muted-foreground h-3.5 w-3.5" aria-hidden />
                  <Eyebrow>{d}</Eyebrow>
                </h4>
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {presets.map((p) => (
                    <li key={p.label}>
                      <Button
                        variant="outline"
                        onClick={() => onSelectGoal(p.label)}
                        className="h-full min-h-11 w-full justify-start gap-3 rounded-xl px-3 py-3 text-left whitespace-normal hover:border-amber-500/40"
                      >
                        <Icon className="text-muted-foreground" aria-hidden />
                        <span className="text-foreground min-w-0 flex-1 text-sm leading-snug font-medium">
                          {p.label}
                        </span>
                        <NavArrowRight className="text-muted-foreground/60" aria-hidden />
                      </Button>
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
