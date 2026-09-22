"use client";

/**
 * Institutional Foundation Ribbon
 *
 * Ambient Apple-style translucent capsule rendered in Economics Act I.
 * Displays the user's active Government structure from Step 3 and dynamically
 * highlights unlocked cross-builder synergies.
 */

import React, { useMemo } from "react";
import { Badge } from "~/components/ui/badge";
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
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/50 bg-card/40 p-3.5 sm:px-4 sm:py-3 backdrop-blur-md shadow-xs transition-all before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-amber-500/20 before:to-transparent",
        className
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: Institutional Foundations from Step 3 */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-500/25 bg-amber-500/10 text-amber-500 dark:text-amber-400">
            <Landmark className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-semibold tracking-tight text-foreground">
                Institutional Foundations
              </h4>
              <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium tracking-wide uppercase text-amber-600 dark:text-amber-400">
                Step 3 Government
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {governmentComponents.slice(0, 5).map((comp) => (
                <Badge
                  key={comp}
                  variant="outline"
                  className="rounded-md border-border/60 bg-background/50 px-2 py-0.5 text-[10px] font-medium text-foreground/90 backdrop-blur-xs transition-colors hover:bg-muted/40 hover:border-border"
                >
                  {formatGovName(comp)}
                </Badge>
              ))}
              {governmentComponents.length > 5 && (
                <span className="text-[10px] font-medium text-muted-foreground/80 pl-0.5">
                  +{governmentComponents.length - 5} more
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Active Synergies indicator */}
        <div className="shrink-0 flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/30">
          {activeSynergies.length > 0 ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 shadow-xs">
                <Zap className="h-3.5 w-3.5 fill-emerald-500/20" />
                <span>
                  {activeSynergies.length} Cross-{activeSynergies.length === 1 ? "Synergy" : "Synergies"} Active
                </span>
              </div>
              <div className="hidden lg:flex items-center gap-1 text-[11px] font-medium text-emerald-600/90 dark:text-emerald-400/90">
                ({activeSynergies[0]?.title}: {activeSynergies[0]?.effect})
                {activeSynergies.length > 1 && (
                  <span className="text-muted-foreground">+{activeSynergies.length - 1} more</span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/20 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
              <span>Select economic models to unlock institutional synergies</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
