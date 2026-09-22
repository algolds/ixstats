"use client";

import React from "react";
import { motion } from "motion/react";
import {
  Coins,
  Group as Users,
  Building,
  Globe,
  Shield,
  LightBulb as Lightbulb,
  NavArrowRight as ChevronRight,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";

export interface NationalConditionScores {
  economicHealth: number; // 0-100
  populationWellbeing: number;
  governmentEfficiency: number;
  diplomaticStanding: number;
  militaryReadiness: number;
  innovationCapacity: number;
}

interface NationalConditionMatrixProps {
  scores?: Partial<NationalConditionScores>;
  onViewAll?: () => void;
  className?: string;
}

interface MetricPillar {
  key: keyof NationalConditionScores;
  label: string;
  category: string;
  icon: typeof Coins;
  color: string;
  bgGradient: string;
  defaultScore: number;
  status: string;
}

const PILLARS: MetricPillar[] = [
  {
    key: "economicHealth",
    label: "Economic Health",
    category: "Macro & Production",
    icon: Coins,
    color: "#38bdf8",
    bgGradient: "from-sky-500/20 to-sky-500/5",
    defaultScore: 85,
    status: "Very Strong",
  },
  {
    key: "populationWellbeing",
    label: "Population Wellbeing",
    category: "Demographics & Health",
    icon: Users,
    color: "#34d399",
    bgGradient: "from-emerald-500/20 to-emerald-500/5",
    defaultScore: 82,
    status: "High Quality of Life",
  },
  {
    key: "governmentEfficiency",
    label: "Government Efficiency",
    category: "Institutions & Law",
    icon: Building,
    color: "#fbbf24",
    bgGradient: "from-amber-500/20 to-amber-500/5",
    defaultScore: 78,
    status: "Stable Operations",
  },
  {
    key: "diplomaticStanding",
    label: "Diplomatic Standing",
    category: "Alliances & Trade",
    icon: Globe,
    color: "#c084fc",
    bgGradient: "from-purple-500/20 to-purple-500/5",
    defaultScore: 68,
    status: "Global Influence",
  },
  {
    key: "militaryReadiness",
    label: "Military Readiness",
    category: "Defense & Security",
    icon: Shield,
    color: "#f87171",
    bgGradient: "from-red-500/20 to-red-500/5",
    defaultScore: 74,
    status: "High Readiness",
  },
  {
    key: "innovationCapacity",
    label: "Innovation & Tech",
    category: "R&D & Infrastructure",
    icon: Lightbulb,
    color: "#818cf8",
    bgGradient: "from-indigo-500/20 to-indigo-500/5",
    defaultScore: 88,
    status: "Technological Frontier",
  },
];

export function NationalConditionMatrix({
  scores,
  onViewAll,
  className,
}: NationalConditionMatrixProps) {
  return (
    <div
      className={cn(
        "facet-surface facet-refraction space-y-4 rounded-2xl border border-white/10 p-5 shadow-lg backdrop-blur-xl",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
            National Performance
          </span>
          <h3 className="text-base font-bold tracking-tight text-foreground">
            National Condition Index
          </h3>
        </div>
        {onViewAll && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewAll}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            All Indicators
            <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PILLARS.map((pillar) => {
          const score = scores?.[pillar.key] ?? pillar.defaultScore;
          const Icon = pillar.icon;

          return (
            <div
              key={pillar.key}
              data-cuelume-press="soft"
              className={cn(
                "group relative flex flex-col justify-between overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br p-3.5 backdrop-blur-md transition-all duration-150 active:scale-[0.98] hover:border-white/20",
                pillar.bgGradient
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5"
                    style={{ color: pillar.color }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">{pillar.label}</h4>
                    <p className="text-[10px] text-muted-foreground">{pillar.category}</p>
                  </div>
                </div>

                <span className="text-sm font-extrabold tracking-tight" style={{ color: pillar.color }}>
                  {score}/100
                </span>
              </div>

              {/* Progress bar */}
              <div className="mt-3 space-y-1">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: pillar.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${score}%` }}
                    transition={{ type: "spring", bounce: 0, duration: 0.8 }}
                  />
                </div>
                <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                  <span>{pillar.status}</span>
                  <span className="font-semibold text-foreground/80">Tier {score > 80 ? "A+" : score > 65 ? "A" : "B"}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
