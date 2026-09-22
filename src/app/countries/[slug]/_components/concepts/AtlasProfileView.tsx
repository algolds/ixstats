"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  MapPin,
  Globe,
  Coins,
  Group as Users,
  Building,
  Shield,
  NavArrowRight as ChevronRight,
  ViewGrid,
  Activity,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { CountryPulseBanner } from "../shared/CountryPulseBanner";
import { RadialCountryDNA } from "../shared/RadialCountryDNA";
import { QuickCompareModal } from "../shared/QuickCompareModal";
import Link from "next/link";
import { createUrl } from "~/lib/utils";

interface AtlasProfileViewProps {
  country: any;
  slug: string;
}

interface ProvinceData {
  id: string;
  name: string;
  type: string;
  population: string;
  popPercent: string;
  gdp: string;
  gdpPercent: string;
  keyIndustries: string[];
  terrain: string;
  color: string;
}

const PROVINCES: ProvinceData[] = [
  {
    id: "venceia",
    name: "Venceia Imperial Capital Metro",
    type: "Federal Capital Territory",
    population: "42.7 Million",
    popPercent: "6.8%",
    gdp: "$8.4 Trillion",
    gdpPercent: "20.9%",
    keyIndustries: ["Finance & Banking", "Aerospace Headquarters", "Governance"],
    terrain: "Coastal Estuary Plain",
    color: "#38bdf8",
  },
  {
    id: "aurelia",
    name: "Aurelia Maritime Harbor",
    type: "Maritime Province",
    population: "31.4 Million",
    popPercent: "5.0%",
    gdp: "$5.8 Trillion",
    gdpPercent: "14.4%",
    keyIndustries: ["Deep-sea Logistics", "Shipbuilding", "Semiconductors"],
    terrain: "Natural Deepwater Bay",
    color: "#34d399",
  },
  {
    id: "sarpedon",
    name: "Sarpedon Industrial Basin",
    type: "Manufacturing Heartland",
    population: "22.8 Million",
    popPercent: "3.6%",
    gdp: "$4.9 Trillion",
    gdpPercent: "12.2%",
    keyIndustries: ["Heavy Machinery", "Rare Earth Refining", "Advanced Robotics"],
    terrain: "River Valley Plateau",
    color: "#fbbf24",
  },
  {
    id: "valeria",
    name: "Valeria Highland Reserve",
    type: "Resource & Energy District",
    population: "14.2 Million",
    popPercent: "2.3%",
    gdp: "$3.1 Trillion",
    gdpPercent: "7.7%",
    keyIndustries: ["Hydroelectric Energy", "Lithium Extraction", "Agriculture"],
    terrain: "Alpine Mountain Range",
    color: "#818cf8",
  },
];

type LayerMode = "territory" | "density" | "economy" | "trade" | "defense";

export function AtlasProfileView({ country, slug }: AtlasProfileViewProps) {
  const [activeLayer, setActiveLayer] = useState<LayerMode>("territory");
  const [selectedProvince, setSelectedProvince] = useState<ProvinceData | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "economy" | "people" | "gov">("overview");
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Narrative Status Pulse */}
      <CountryPulseBanner country={country} />

      {/* ── 50/50 Geospatial Atlas Console ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left 50%: 2.5D Interactive Vector Atlas Canvas (6 cols) */}
        <div className="space-y-4 lg:col-span-6">
          <div className="facet-surface facet-refraction relative flex h-[620px] flex-col justify-between overflow-hidden rounded-3xl border border-white/10 p-6 shadow-2xl backdrop-blur-2xl">
            {/* Top Atlas Layer Switcher Bar */}
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <ViewGrid className="h-4 w-4 text-[var(--flag-primary)]" />
                <span className="text-xs font-extrabold uppercase tracking-wider text-foreground">
                  Geopolitical Atlas
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-black/40 p-1 backdrop-blur-md">
                {(
                  [
                    { id: "territory", label: "Territory" },
                    { id: "density", label: "Density" },
                    { id: "economy", label: "Economic" },
                    { id: "trade", label: "Trade Arcs" },
                    { id: "defense", label: "Defense" },
                  ] as const
                ).map((layer) => (
                  <button
                    key={layer.id}
                    type="button"
                    data-cuelume-press="soft"
                    onClick={() => setActiveLayer(layer.id)}
                    className={cn(
                      "rounded-lg px-2 py-1 text-[11px] font-bold transition-all duration-150 active:scale-[0.96]",
                      activeLayer === layer.id
                        ? "bg-[var(--flag-primary)] text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {layer.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive Vector Province Selection Map Grid */}
            <div className="relative my-auto flex flex-col items-center justify-center space-y-4">
              <div className="text-center">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Select a Territorial Entity
                </span>
                <p className="text-xs text-muted-foreground">
                  Click any province to dynamically focus contextual telemetry
                </p>
              </div>

              {/* Province Cards Mesh */}
              <div className="grid w-full grid-cols-2 gap-3">
                {PROVINCES.map((prov) => {
                  const isSelected = selectedProvince?.id === prov.id;
                  return (
                    <button
                      key={prov.id}
                      type="button"
                      data-cuelume-press="soft"
                      onClick={() => setSelectedProvince(isSelected ? null : prov)}
                      className={cn(
                        "group flex flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-200 active:scale-[0.97] backdrop-blur-md",
                        isSelected
                          ? "border-[var(--flag-primary)] bg-[var(--flag-primary)]/15 shadow-[0_0_20px_rgba(56,189,248,0.2)]"
                          : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <span className="text-sm font-bold text-foreground">{prov.name}</span>
                        <div
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: prov.color }}
                        />
                      </div>
                      <div className="mt-3 flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">{prov.population}</span>
                        <span className="font-extrabold text-foreground">{prov.gdp}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {selectedProvince ? selectedProvince.name : "National Overview Selected"}
                </span>
              </div>

              <Link
                href={createUrl("/maps")}
                className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-foreground transition-all duration-150 active:scale-[0.96] hover:bg-white/10"
              >
                <span>⤢ Fullscreen IxWorld</span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
            </div>
          </div>
        </div>

        {/* Right 50%: Dynamic Contextual Intelligence HUD (6 cols) */}
        <div className="space-y-4 lg:col-span-6">
          <div className="facet-surface facet-refraction flex h-[620px] flex-col justify-between overflow-hidden rounded-3xl border border-white/10 p-6 shadow-2xl backdrop-blur-2xl">
            {/* Top HUD Context Status */}
            <div>
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--flag-primary)]">
                    Intelligence Feed
                  </span>
                  <h3 className="text-lg font-bold tracking-tight text-foreground truncate">
                    {selectedProvince ? selectedProvince.name : `${country.name} National HUD`}
                  </h3>
                </div>

                <div className="flex items-center gap-1">
                  {(["overview", "economy", "people", "gov"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      data-cuelume-press="soft"
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-xs font-bold capitalize transition-all duration-150 active:scale-[0.96]",
                        activeTab === tab
                          ? "bg-white/10 text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Contextual Intelligence Body */}
              <div className="mt-4 space-y-4 overflow-y-auto pr-1">
                {selectedProvince ? (
                  // Province-specific view
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">
                          Provincial Population
                        </p>
                        <p className="text-base font-extrabold text-foreground mt-0.5">
                          {selectedProvince.population}
                        </p>
                        <p className="text-[10px] text-blue-400">
                          {selectedProvince.popPercent} of National Total
                        </p>
                      </div>

                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">
                          Regional GDP Output
                        </p>
                        <p className="text-base font-extrabold text-emerald-400 mt-0.5">
                          {selectedProvince.gdp}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {selectedProvince.gdpPercent} of Total Economy
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-2">
                      <p className="text-xs font-bold text-foreground">Principal Economic Sectors</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedProvince.keyIndustries.map((ind, i) => (
                          <span
                            key={i}
                            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-foreground"
                          >
                            {ind}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-1">
                      <p className="text-xs font-bold text-foreground">Terrain & Topography</p>
                      <p className="text-xs text-muted-foreground">{selectedProvince.terrain}</p>
                    </div>
                  </div>
                ) : (
                  // National Aggregate View
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Total GDP</p>
                        <p className="text-base font-extrabold text-foreground mt-0.5">
                          ${((country.currentTotalGdp || 40200000000000) / 1000000000000).toFixed(1)}T
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Population</p>
                        <p className="text-base font-extrabold text-foreground mt-0.5">
                          {((country.currentPopulation || 626200000) / 1000000).toFixed(1)}M
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Provinces</p>
                        <p className="text-base font-extrabold text-sky-400 mt-0.5">42 Total</p>
                      </div>
                    </div>

                    {/* Integrated Mini DNA */}
                    <div className="flex justify-center">
                      <RadialCountryDNA countryName={country.name} size={220} showLabels={false} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Quick Tools */}
            <div className="flex items-center justify-between border-t border-white/10 pt-4">
              <button
                type="button"
                data-cuelume-press="soft"
                onClick={() => setIsCompareOpen(true)}
                className="text-xs font-bold text-[var(--flag-primary)] hover:underline flex items-center gap-1"
              >
                <span>⚖️ Open Benchmarking Workspace</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                data-cuelume-press="soft"
                onClick={() => setSelectedProvince(null)}
                className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Reset Focus
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Compare Modal */}
      <QuickCompareModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        currentCountry={country}
      />
    </div>
  );
}
