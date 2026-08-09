"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { HealthRing } from "~/components/ui/health-ring";
import { Badge } from "~/components/ui/badge";
import { FacetCard } from "~/components/ui/facet-container";
import { cn } from "~/lib/utils";
import { Activity, DollarSign, Users, Globe, Building, CheckCircle2 } from "lucide-react";
import type { VitalityRing } from "../mycountry/primitives/tabs/VitalityRingsDisplay";

interface VitalityBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  rings: VitalityRing[];
  countryName?: string;
}

const DOMAIN_CONFIG: Record<
  string,
  {
    title: string;
    description: string;
    drivers: string[];
    bgClass: string;
    borderClass: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  economic: {
    title: "Economic Vitality",
    description:
      "Measures GDP growth rate, labor market health, fiscal balance, and inflation stability.",
    drivers: ["Real GDP Growth", "Employment & Wages", "Fiscal System & Tax Yield"],
    bgClass: "bg-amber-500/10 dark:bg-amber-500/15",
    borderClass: "border-amber-500/20 dark:border-amber-500/30",
    icon: DollarSign,
  },
  population: {
    title: "Population Wellbeing",
    description: "Assesses public health, education, demographic growth, and societal welfare.",
    drivers: [
      "Public Healthcare Access",
      "Demographic Replacement Rate",
      "Social Security Coverage",
    ],
    bgClass: "bg-cyan-500/10 dark:bg-cyan-500/15",
    borderClass: "border-cyan-500/20 dark:border-cyan-500/30",
    icon: Users,
  },
  diplomatic: {
    title: "Diplomatic Standing",
    description:
      "Evaluates embassy networks, international treaty standing, and regional soft power.",
    drivers: [
      "Active Bilateral Embassies",
      "Alliance Treaties & Pacts",
      "Global Prestige & Soft Power",
    ],
    bgClass: "bg-purple-500/10 dark:bg-purple-500/15",
    borderClass: "border-purple-500/20 dark:border-purple-500/30",
    icon: Globe,
  },
  government: {
    title: "Government Efficiency",
    description:
      "Tracks civil service capacity utilization, legislative throughput, and bureaucracy health.",
    drivers: [
      "Civil Service Utilization",
      "Policy Implementation Speed",
      "Administrative Capacity",
    ],
    bgClass: "bg-red-500/10 dark:bg-red-500/15",
    borderClass: "border-red-500/20 dark:border-red-500/30",
    icon: Building,
  },
};

export function VitalityBreakdownModal({
  isOpen,
  onClose,
  rings,
  countryName,
}: VitalityBreakdownModalProps) {
  const avgScore =
    rings.length > 0 ? Math.round(rings.reduce((sum, r) => sum + r.value, 0) / rings.length) : 0;

  const getOverallRating = (score: number) => {
    if (score >= 85)
      return {
        label: "Optimal Standing",
        cls: "bg-emerald-500/20 text-emerald-500 dark:text-emerald-400 border-emerald-500/30",
      };
    if (score >= 70)
      return {
        label: "Strong Standing",
        cls: "bg-cyan-500/20 text-cyan-500 dark:text-cyan-400 border-cyan-500/30",
      };
    if (score >= 50)
      return {
        label: "Moderate Standing",
        cls: "bg-amber-500/20 text-amber-500 dark:text-amber-400 border-amber-500/30",
      };
    return {
      label: "Strained Standing",
      cls: "bg-red-500/20 text-red-500 dark:text-red-400 border-red-500/30",
    };
  };

  const rating = getOverallRating(avgScore);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-border/60 bg-background/95 text-foreground max-w-2xl shadow-2xl backdrop-blur-2xl sm:rounded-2xl">
        <DialogHeader className="border-border/40 border-b pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="border-primary/20 bg-primary/10 flex h-9 w-9 items-center justify-center rounded-xl border">
                <Activity className="text-primary h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold tracking-tight">
                  National Vitality Breakdown {countryName ? `— ${countryName}` : ""}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs">
                  Real-time diagnostic analysis across the 4 key national vitality pillars.
                </DialogDescription>
              </div>
            </div>
            <Badge
              variant="outline"
              className={cn("px-2.5 py-1 text-xs font-bold uppercase", rating.cls)}
            >
              {rating.label} ({avgScore}/100)
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-3">
          {/* Grid of the 4 Vitality Pillars built with Facet cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {rings.map((ring) => {
              const meta = DOMAIN_CONFIG[ring.id] ?? {
                title: ring.label,
                description: ring.description ?? "",
                drivers: [],
                bgClass: "bg-muted/20",
                borderClass: "border-border/40",
                icon: Activity,
              };
              const Icon = meta.icon;

              const getPillarStatus = (val: number) => {
                if (val >= 80)
                  return { text: "Optimal", color: "text-emerald-500 dark:text-emerald-400" };
                if (val >= 60) return { text: "Stable", color: "text-cyan-500 dark:text-cyan-400" };
                if (val >= 40)
                  return { text: "Moderate", color: "text-amber-500 dark:text-amber-400" };
                return { text: "Attention Needed", color: "text-red-500 dark:text-red-400" };
              };

              const pillarStatus = getPillarStatus(ring.value);

              return (
                <FacetCard
                  key={ring.id}
                  depth={2}
                  className={cn(
                    "flex flex-col justify-between rounded-xl p-3.5 backdrop-blur-md transition-all",
                    meta.bgClass,
                    meta.borderClass
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="border-border/40 bg-background/50 flex h-7 w-7 items-center justify-center rounded-lg border">
                        <Icon className="text-foreground h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-foreground text-xs font-bold">{meta.title}</h4>
                        <span className={cn("text-[10px] font-semibold", pillarStatus.color)}>
                          {pillarStatus.text}
                        </span>
                      </div>
                    </div>
                    <HealthRing
                      value={ring.value}
                      size={44}
                      color={ring.color}
                      label={ring.label}
                    />
                  </div>

                  <p className="text-muted-foreground mt-2.5 text-[11px] leading-relaxed font-medium">
                    {meta.description}
                  </p>

                  <div className="border-border/30 mt-3 border-t pt-2">
                    <span className="text-muted-foreground/70 text-[9px] font-extrabold tracking-wider uppercase">
                      Core Drivers
                    </span>
                    <ul className="mt-1 space-y-1">
                      {meta.drivers.map((driver) => (
                        <li
                          key={driver}
                          className="text-foreground/80 flex items-center gap-1.5 text-[10px]"
                        >
                          <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500 dark:text-emerald-400" />
                          <span className="truncate">{driver}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </FacetCard>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
