"use client";

import React from "react";
import { motion } from "motion/react";
import { Suitcase as Briefcase, NavArrowRight as ChevronRight } from "iconoir-react";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { SectorBreakdownCard } from "~/components/mycountry/shared/primitives";

interface EconomyBusinessSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
}

export function EconomyBusinessSection({
  isExpanded,
  onToggle,
}: EconomyBusinessSectionProps): React.JSX.Element {
  return (
    <div className="flex flex-col">
      <div className="flex">
        <button
          type="button"
          onClick={onToggle}
          className={`relative z-10 flex cursor-pointer items-center gap-2 rounded-t-xl border-x border-t px-4 py-2 text-xs font-bold tracking-wider uppercase transition-all duration-200 ${
            isExpanded
              ? "text-foreground border-white/10 bg-white/10 dark:bg-white/[0.04]"
              : "text-muted-foreground hover:text-foreground border-transparent bg-transparent"
          }`}
        >
          <Briefcase
            className={`h-3.5 w-3.5 ${isExpanded ? "text-emerald-500" : "text-muted-foreground/60"}`}
          />
          <span>Business & Innovation Climate</span>
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.25 }}
            className="ml-1"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </motion.div>
        </button>
      </div>
      <motion.div
        initial={false}
        animate={{ height: isExpanded ? "auto" : 0 }}
        transition={{ type: "spring", bounce: 0, duration: 0.35 }}
        className={`relative overflow-hidden rounded-tr-xl rounded-b-xl bg-white/10 backdrop-blur-xs transition-colors duration-200 dark:bg-white/[0.03] ${
          isExpanded ? "border border-white/10" : "border border-transparent"
        }`}
      >
        <TextureOverlay
          texture="paperGrain"
          opacity={0.06}
          className="pointer-events-none absolute inset-0 z-0"
        />
        <div className="relative z-10 space-y-4 p-4">
          <div className="border-border/10 grid grid-cols-2 gap-4 rounded-xl border bg-white/10 p-3 md:grid-cols-4 dark:bg-white/[0.02]">
            <div className="min-w-0">
              <p className="text-muted-foreground/60 text-[9px] font-semibold tracking-wider uppercase">
                Doing Business
              </p>
              <p className="text-foreground mt-0.5 text-sm font-bold">Rank #45</p>
              <p className="text-muted-foreground/80 mt-0.5 text-[10px]">Out of 190 countries</p>
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground/60 text-[9px] font-semibold tracking-wider uppercase">
                Startup Formation
              </p>
              <p className="text-foreground mt-0.5 text-sm font-bold">12.5</p>
              <p className="text-muted-foreground/80 mt-0.5 text-[10px]">Per 1,000 citizens</p>
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground/60 text-[9px] font-semibold tracking-wider uppercase">
                R&D Investment
              </p>
              <p className="text-foreground mt-0.5 text-sm font-bold">2.8%</p>
              <p className="text-muted-foreground/80 mt-0.5 text-[10px]">Share of GDP</p>
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground/60 text-[9px] font-semibold tracking-wider uppercase">
                FDI Inflow
              </p>
              <p className="text-foreground mt-0.5 text-sm font-bold">2.5%</p>
              <p className="text-muted-foreground/80 mt-0.5 text-[10px]">Of nominal GDP</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SectorBreakdownCard
              title="Regulatory Environment"
              subtitle="Key regulatory and startup ease metrics"
              layout="list"
              showProgressBars={true}
              cardWrapper="panel"
              accent="emerald"
              sectors={[
                {
                  id: "time",
                  name: "Time to Start (days)",
                  value: 0,
                  percentage: 92,
                  color: "green",
                  description: "8 days",
                },
                {
                  id: "cost",
                  name: "Cost to Start (% income)",
                  value: 0,
                  percentage: 97.5,
                  color: "blue",
                  description: "2.5%",
                },
                {
                  id: "regulatory",
                  name: "Regulatory Quality",
                  value: 0,
                  percentage: 72,
                  color: "purple",
                  trend: "up",
                  trendValue: 2.3,
                },
                {
                  id: "finance",
                  name: "Access to Finance",
                  value: 0,
                  percentage: 68,
                  color: "amber",
                  trend: "up",
                  trendValue: 1.5,
                },
              ]}
            />
            <SectorBreakdownCard
              title="Business Size Composition"
              subtitle="Distribution of business by personnel size"
              layout="list"
              showProgressBars={true}
              cardWrapper="panel"
              accent="emerald"
              sectors={[
                {
                  id: "small",
                  name: "Small Businesses (0-50)",
                  value: 0,
                  percentage: 85,
                  color: "green",
                },
                {
                  id: "medium",
                  name: "Medium Businesses (50-250)",
                  value: 0,
                  percentage: 12,
                  color: "blue",
                },
                {
                  id: "large",
                  name: "Large Businesses (250+)",
                  value: 0,
                  percentage: 3,
                  color: "purple",
                },
                {
                  id: "entrepreneurship",
                  name: "Entrepreneurship Rate",
                  value: 0,
                  percentage: 15.2,
                  color: "amber",
                  trend: "up",
                  trendValue: 0.8,
                },
              ]}
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
