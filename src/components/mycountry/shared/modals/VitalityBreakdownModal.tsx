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
import { cn } from "~/lib/utils/cn";
import {
  Activity,
  Dollar as DollarSign,
  Group as Users,
  Globe,
  Building,
  CheckCircle as CheckCircle2,
} from "iconoir-react";
import { Eyebrow } from "~/components/ui/eyebrow";
import type { VitalityRing } from "~/components/mycountry/shared/primitives/tabs/VitalityRingsDisplay";

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
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  economic: {
    title: "Economic Vitality",
    description:
      "Measures GDP growth rate, labor market health, fiscal balance, and inflation stability.",
    drivers: ["Real GDP Growth", "Employment & Wages", "Fiscal System & Tax Yield"],
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
    if (score >= 85) return { label: "Optimal Standing", cls: "text-emerald-500" };
    if (score >= 70) return { label: "Strong Standing", cls: "text-foreground" };
    if (score >= 50) return { label: "Moderate Standing", cls: "text-amber-500" };
    return { label: "Strained Standing", cls: "text-destructive" };
  };

  const rating = getOverallRating(avgScore);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="border-border border-b pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Activity className="text-muted-foreground h-5 w-5" />
              <div>
                <DialogTitle className="text-base font-semibold">
                  National Vitality Breakdown {countryName ? `— ${countryName}` : ""}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs">
                  Real-time diagnostic analysis across the 4 key national vitality pillars.
                </DialogDescription>
              </div>
            </div>
            <Badge variant="outline" className={rating.cls}>
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
                icon: Activity,
              };
              const Icon = meta.icon;

              const getPillarStatus = (val: number) => {
                if (val >= 80) return { text: "Optimal", color: "text-emerald-500" };
                if (val >= 60) return { text: "Stable", color: "text-muted-foreground" };
                if (val >= 40) return { text: "Moderate", color: "text-amber-500" };
                return { text: "Attention Needed", color: "text-destructive" };
              };

              const pillarStatus = getPillarStatus(ring.value);

              return (
                <FacetCard
                  key={ring.id}
                  surface="solid"
                  className="flex flex-col justify-between rounded-xl p-3.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Icon className="text-muted-foreground h-4 w-4 shrink-0" />
                      <div>
                        <h4 className="text-foreground text-sm font-semibold">{meta.title}</h4>
                        <span className={cn("text-xs font-semibold", pillarStatus.color)}>
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

                  <p className="text-muted-foreground mt-2.5 text-xs leading-relaxed">
                    {meta.description}
                  </p>

                  <div className="border-border mt-3 border-t pt-2">
                    <Eyebrow>Core drivers</Eyebrow>
                    <ul className="mt-1 space-y-1">
                      {meta.drivers.map((driver) => (
                        <li
                          key={driver}
                          className="text-foreground/80 flex items-center gap-1.5 text-xs"
                        >
                          <CheckCircle2 className="text-muted-foreground h-3 w-3 shrink-0" />
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
