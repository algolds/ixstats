"use client";

/**
 * Institutional Foundation Ribbon
 *
 * A Facet card rendered in Economics Act I.
 * Displays the user's active Government structure from Step 3 and dynamically
 * highlights unlocked cross-builder synergies.
 */

import React, { useMemo } from "react";
import { Badge } from "~/components/ui/badge";
import { FacetCard } from "~/components/ui/facet-container";
import { Bank as Landmark, Flash as Zap } from "iconoir-react";
import { cn } from "~/lib/utils";

export interface InstitutionalFoundationRibbonProps {
  /** Array of active Government component keys or names from Step 3 */
  governmentComponents?: string[];
  /** Array of currently selected Economic component keys or names from Step 4 */
  economicComponents?: string[];
  className?: string;
}

interface CrossSynergyRule {
  govPattern: RegExp;
  econPattern: RegExp;
  title: string;
  effect: string;
}

const CROSS_SYNERGY_RULES: CrossSynergyRule[] = [
  {
    govPattern: /RULE_OF_LAW|LAW/i,
    econPattern: /FREE_MARKET|COMPETITIVE/i,
    title: "Enforceable Contracts",
    effect: "+15% Private Investment",
  },
  {
    govPattern: /DIGITAL_GOVERNMENT|E_GOVERNANCE|DIGITAL_INFRASTRUCTURE/i,
    econPattern: /KNOWLEDGE_ECONOMY|INNOVATION_ECONOMY|TECH/i,
    title: "Digital Leapfrog",
    effect: "+20% Tech Productivity",
  },
  {
    govPattern: /DEMOCRATIC_PROCESS|CONSENSUS/i,
    econPattern: /PROTECTED_WORKERS|UNION_BASED|FLEXIBLE_LABOR/i,
    title: "Labor Compact",
    effect: "+12% Labor Stability",
  },
  {
    govPattern: /WELFARE_STATE|SOCIAL_SAFETY/i,
    econPattern: /SOCIAL_MARKET|MIXED_ECONOMY/i,
    title: "Nordic Consensus",
    effect: "+18% Social Equity",
  },
  {
    govPattern: /PROFESSIONAL_BUREAUCRACY|MERIT_BASED/i,
    econPattern: /EXPORT_ORIENTED|MANUFACTURING/i,
    title: "Export Machine",
    effect: "+10% Export Efficiency",
  },
  {
    govPattern: /SURVEILLANCE_SYSTEM|AUTOCRATIC/i,
    econPattern: /STATE_CAPITALISM|PLANNED_ECONOMY/i,
    title: "Command Directives",
    effect: "+25% Resource Mobilization",
  },
  {
    govPattern: /ENVIRONMENTAL_PROTECTION/i,
    econPattern: /GREEN_TECHNOLOGY|CIRCULAR_ECONOMY|RENEWABLE/i,
    title: "Eco Transition",
    effect: "+20% Green Transition",
  },
];

function formatGovName(key: string): string {
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export const InstitutionalFoundationRibbon = React.memo(function InstitutionalFoundationRibbon({
  governmentComponents = [],
  economicComponents = [],
  className,
}: InstitutionalFoundationRibbonProps) {
  // Find active cross-builder synergies
  const activeSynergies = useMemo(() => {
    if (!governmentComponents.length || !economicComponents.length) return [];

    const matches: { title: string; effect: string }[] = [];
    CROSS_SYNERGY_RULES.forEach((rule) => {
      const hasGov = governmentComponents.some((g) => rule.govPattern.test(g));
      const hasEcon = economicComponents.some((e) => rule.econPattern.test(e));
      if (hasGov && hasEcon) {
        matches.push({ title: rule.title, effect: rule.effect });
      }
    });
    return matches;
  }, [governmentComponents, economicComponents]);

  if (governmentComponents.length === 0) {
    return null;
  }

  return (
    <FacetCard className={cn("rounded-2xl p-4", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: institutional foundations from Step 3 */}
        <div className="flex min-w-0 items-start gap-3">
          <Landmark
            aria-hidden="true"
            className="mt-0.5 h-5 w-5 shrink-0 text-(--facet-mycountry)"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-foreground text-sm font-semibold tracking-tight">
                Institutional foundations
              </h4>
              <Badge variant="outline" className="text-muted-foreground">
                Step 3 · Government
              </Badge>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {governmentComponents.slice(0, 5).map((comp) => (
                <Badge key={comp} variant="secondary">
                  {formatGovName(comp)}
                </Badge>
              ))}
              {governmentComponents.length > 5 && (
                <span className="text-muted-foreground pl-0.5 text-xs font-medium">
                  +{governmentComponents.length - 5} more
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: active cross-builder synergies */}
        <div className="border-border/60 flex shrink-0 items-center gap-2 border-t pt-2 sm:border-t-0 sm:pt-0">
          {activeSynergies.length > 0 ? (
            <>
              <Badge variant="outline" className="text-emerald-600">
                <Zap aria-hidden="true" />
                {activeSynergies.length} cross-
                {activeSynergies.length === 1 ? "synergy" : "synergies"} active
              </Badge>
              <span className="text-muted-foreground hidden text-xs lg:inline">
                <span className="text-foreground font-medium">{activeSynergies[0]?.title}</span>:{" "}
                {activeSynergies[0]?.effect}
                {activeSynergies.length > 1 && ` · +${activeSynergies.length - 1} more`}
              </span>
            </>
          ) : (
            <p className="text-muted-foreground text-xs">
              Select economic models to unlock institutional synergies
            </p>
          )}
        </div>
      </div>
    </FacetCard>
  );
});
