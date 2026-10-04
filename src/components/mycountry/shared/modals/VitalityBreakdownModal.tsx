"use client";

import React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "~/components/ui/sheet";
import { HealthRing } from "~/components/ui/health-ring";
import { Badge } from "~/components/ui/badge";
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
import type { VitalityRing } from "~/components/mycountry/shared/primitives/tabs/vitality";
import { Card } from "~/components/ui/card";

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
    title: "Economic vitality",
    description:
      "Measures GDP growth rate, labor market health, fiscal balance, and inflation stability.",
    drivers: ["Real GDP Growth", "Employment & Wages", "Fiscal System & Tax Yield"],
    icon: DollarSign,
  },
  population: {
    title: "Population wellbeing",
    description: "Assesses public health, education, demographic growth, and societal welfare.",
    drivers: [
      "Public Healthcare Access",
      "Demographic Replacement Rate",
      "Social Security Coverage",
    ],
    icon: Users,
  },
  diplomatic: {
    title: "Diplomatic standing",
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
    title: "Government efficiency",
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
    if (score >= 85) return { label: "Optimal standing", cls: "text-green" };
    if (score >= 70) return { label: "Strong standing", cls: "text-label" };
    if (score >= 50) return { label: "Moderate standing", cls: "text-yellow" };
    return { label: "Strained standing", cls: "text-destructive" };
  };

  const rating = getOverallRating(avgScore);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent size="wide" className="overflow-y-auto">
        <SheetHeader className="border-separator border-b pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Activity className="text-label-secondary h-5 w-5" />
              <div>
                <SheetTitle className="text-title-3">
                  National vitality{countryName ? `: ${countryName}` : ""}
                </SheetTitle>
                <SheetDescription className="text-label-secondary text-footnote">
                  Real-time diagnostic analysis across the 4 key national vitality pillars.
                </SheetDescription>
              </div>
            </div>
            <Badge variant="outline" className={rating.cls}>
              {rating.label} ({avgScore}/100)
            </Badge>
          </div>
        </SheetHeader>

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
                if (val >= 80) return { text: "Optimal", color: "text-green" };
                if (val >= 60) return { text: "Stable", color: "text-label-secondary" };
                if (val >= 40) return { text: "Moderate", color: "text-yellow" };
                return { text: "Attention Needed", color: "text-destructive" };
              };

              const pillarStatus = getPillarStatus(ring.value);

              return (
                <Card variant="well" key={ring.id} className="flex flex-col justify-between p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Icon className="text-label-secondary h-4 w-4 shrink-0" />
                      <div>
                        <h4 className="text-label text-headline">{meta.title}</h4>
                        <span className={cn("text-caption font-semibold", pillarStatus.color)}>
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

                  <p className="text-label-secondary text-footnote mt-2 leading-relaxed">
                    {meta.description}
                  </p>

                  <div className="border-separator mt-3 border-t pt-2">
                    <Eyebrow>Core drivers</Eyebrow>
                    <ul className="mt-1 space-y-1">
                      {meta.drivers.map((driver) => (
                        <li
                          key={driver}
                          className="text-label-secondary text-footnote flex items-center gap-2"
                        >
                          <CheckCircle2 className="text-label-secondary h-3 w-3 shrink-0" />
                          <span className="truncate">{driver}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
