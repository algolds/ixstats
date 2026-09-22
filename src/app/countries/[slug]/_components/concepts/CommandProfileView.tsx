"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import {
  Coins,
  Group as Users,
  Building,
  Globe,
  Shield,
  LightBulb as Lightbulb,
  Sparks as Sparkles,
  MapPin,
  Clock,
  OpenBook as BookOpen,
  NavArrowRight as ChevronRight,
  StatUp as TrendingUp,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { CountryPulseBanner } from "../shared/CountryPulseBanner";
import { RadialCountryDNA } from "../shared/RadialCountryDNA";
import { NationalConditionMatrix } from "../shared/NationalConditionMatrix";
import { GlobalPositionRankings, type RankingItem } from "../shared/GlobalPositionRankings";
import { StateStructureTree } from "../shared/StateStructureTree";
import { DiplomaticMatrixCard } from "../shared/DiplomaticMatrixCard";
import { QuickCompareModal } from "../shared/QuickCompareModal";
import Link from "next/link";
import { createUrl } from "~/lib/utils";

interface CommandProfileViewProps {
  country: any;
  slug: string;
}

const DOCK_ITEMS = [
  { id: "glance", label: "At a Glance", icon: Sparkles },
  { id: "dna", label: "Country DNA", icon: Lightbulb },
  { id: "people", label: "People & Society", icon: Users },
  { id: "economy", label: "Economy & Trade", icon: Coins },
  { id: "territory", label: "Territory & Map", icon: MapPin },
  { id: "governance", label: "Governance & Law", icon: Building },
  { id: "foreign", label: "Foreign Affairs", icon: Globe },
  { id: "defense", label: "Defense & Security", icon: Shield },
  { id: "dossier", label: "Editorial Dossier", icon: BookOpen },
  { id: "timeline", label: "Timeline", icon: Clock },
];

export function CommandProfileView({ country, slug }: CommandProfileViewProps) {
  const [activeAnchor, setActiveAnchor] = useState("glance");
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  const scrollTo = (id: string) => {
    setActiveAnchor(id);
    const el = document.getElementById(`section-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const gdpFormatted = `$${((country.currentTotalGdp || 40200000000000) / 1000000000000).toFixed(1)}T`;
  const popFormatted = `${((country.currentPopulation || 626200000) / 1000000).toFixed(1)}M`;
  const perCapitaFormatted = `$${Math.round(country.currentGdpPerCapita || 64273).toLocaleString()}`;
  const areaFormatted = country.landArea ? `${(country.landArea / 1000).toFixed(0)}k km²` : "7.5M km²";

  return (
    <div className="space-y-6">
      {/* ── Country Pulse Narrative Status ── */}
      <CountryPulseBanner country={country} />

      {/* ── Grid: Left Sticky Dock + Right Spatial Stream ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Dock Rail (3 cols, sticky) */}
        <div className="lg:col-span-3">
          <div className="lg:sticky lg:top-20 space-y-4">
            <nav className="facet-surface facet-refraction space-y-1 rounded-2xl border border-white/10 p-2 shadow-lg backdrop-blur-xl">
              <div className="px-3 py-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Command Dock
                </span>
                <p className="text-xs font-bold text-foreground">Sovereign Stream</p>
              </div>

              {DOCK_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeAnchor === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    data-cuelume-press="soft"
                    onClick={() => scrollTo(item.id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold transition-all duration-150 active:scale-[0.97]",
                      isActive
                        ? "bg-[var(--flag-primary)]/15 text-[var(--flag-primary)] shadow-sm ring-1 ring-[var(--flag-primary)]/30"
                        : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Quick Action Card */}
            <div className="facet-surface facet-refraction space-y-2 rounded-2xl border border-white/10 p-4 shadow-lg backdrop-blur-xl">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                Sovereign Tools
              </span>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  data-cuelume-press="soft"
                  onClick={() => setIsCompareOpen(true)}
                  className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-foreground transition-all duration-150 active:scale-[0.97] hover:bg-white/10"
                >
                  <span>⚖️ Benchmark Peer</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <Link
                  href={createUrl(`/countries/${slug}/modeling`)}
                  className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-foreground transition-all duration-150 active:scale-[0.97] hover:bg-white/10"
                >
                  <span>📈 Economic Modeling</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </Link>
                <Link
                  href={createUrl("/maps")}
                  className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-foreground transition-all duration-150 active:scale-[0.97] hover:bg-white/10"
                >
                  <span>🗺️ IxWorld Atlas</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Right Continuous Spatial Stream (9 cols) */}
        <div className="lg:col-span-9 space-y-6">
          {/* Section 1: At a Glance & National Condition */}
          <div id="section-glance" className="space-y-6 scroll-mt-24">
            <NationalConditionMatrix />
            <GlobalPositionRankings
              countryName={country.name}
              onOpenCompare={() => setIsCompareOpen(true)}
            />
          </div>

          {/* Section 2: Country DNA */}
          <div id="section-dna" className="scroll-mt-24">
            <RadialCountryDNA countryName={country.name} />
          </div>

          {/* Section 3: People & Society */}
          <div
            id="section-people"
            className="facet-surface facet-refraction space-y-4 rounded-2xl border border-white/10 p-5 shadow-lg backdrop-blur-xl scroll-mt-24"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Demographics & Society
                </span>
                <h3 className="text-base font-bold tracking-tight text-foreground">
                  People & Society
                </h3>
              </div>
              <span className="text-xs font-bold text-emerald-400">{popFormatted} Citizens</span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Workforce</p>
                <p className="text-sm font-extrabold text-foreground mt-0.5">407.0 Million</p>
                <p className="text-[10px] text-emerald-400">65% Participation</p>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Urbanization</p>
                <p className="text-sm font-extrabold text-foreground mt-0.5">76.4% Urban</p>
                <p className="text-[10px] text-muted-foreground">317 Major Cities</p>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Literacy</p>
                <p className="text-sm font-extrabold text-foreground mt-0.5">98.2%</p>
                <p className="text-[10px] text-blue-400">Higher Ed: 38%</p>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Life Expectancy</p>
                <p className="text-sm font-extrabold text-foreground mt-0.5">79.4 Years</p>
                <p className="text-[10px] text-purple-400">Median Age: 36.8y</p>
              </div>
            </div>
          </div>

          {/* Section 4: Economy & Trade */}
          <div
            id="section-economy"
            className="facet-surface facet-refraction space-y-4 rounded-2xl border border-white/10 p-5 shadow-lg backdrop-blur-xl scroll-mt-24"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Macroeconomics & Trade
                </span>
                <h3 className="text-base font-bold tracking-tight text-foreground">
                  Economy & Industrial Output
                </h3>
              </div>
              <span className="text-xs font-bold text-sky-400">{gdpFormatted} Total GDP</span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">GDP per Capita</p>
                <p className="text-base font-extrabold text-foreground mt-0.5">{perCapitaFormatted}</p>
                <p className="text-[10px] text-muted-foreground">{country.economicTier || "Extravagant"} Tier</p>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Real Growth</p>
                <p className="text-base font-extrabold text-emerald-400 mt-0.5">+2.4% Annual</p>
                <p className="text-[10px] text-muted-foreground">Inflation: 2.1%</p>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Trade Balance</p>
                <p className="text-base font-extrabold text-sky-400 mt-0.5">+$1.2T Surplus</p>
                <p className="text-[10px] text-muted-foreground">Exports: $5.8T / Imports: $4.6T</p>
              </div>
            </div>

            {/* Major Industries */}
            <div className="space-y-2 pt-2">
              <p className="text-xs font-bold text-foreground">Major Industrial Sectors</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                  <p className="text-xs font-bold text-foreground">🚀 Aerospace & Defense</p>
                  <p className="text-[11px] text-muted-foreground">$4.8T · 12.0% of GDP</p>
                </div>
                <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                  <p className="text-xs font-bold text-foreground">⚡ High Technology & AI</p>
                  <p className="text-[11px] text-muted-foreground">$7.3T · 18.1% of GDP</p>
                </div>
                <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                  <p className="text-xs font-bold text-foreground">🏗️ Heavy Manufacturing</p>
                  <p className="text-[11px] text-muted-foreground">$6.1T · 15.2% of GDP</p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 5: Territory & Cities */}
          <div
            id="section-territory"
            className="facet-surface facet-refraction space-y-4 rounded-2xl border border-white/10 p-5 shadow-lg backdrop-blur-xl scroll-mt-24"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Geospatial Intelligence
                </span>
                <h3 className="text-base font-bold tracking-tight text-foreground">
                  Territory & Principal Cities
                </h3>
              </div>
              <span className="text-xs font-bold text-foreground">{areaFormatted} Land Area</span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Major Cities List */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-foreground">Principal Metropolises</p>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                    <div>
                      <p className="text-xs font-bold text-foreground">🏛️ Venceia (Capital)</p>
                      <p className="text-[10px] text-muted-foreground">Seat of Imperial Government</p>
                    </div>
                    <span className="text-xs font-extrabold text-foreground">42.7M</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                    <div>
                      <p className="text-xs font-bold text-foreground">🚢 Aurelia Harbor</p>
                      <p className="text-[10px] text-muted-foreground">Principal Maritime Gateway</p>
                    </div>
                    <span className="text-xs font-extrabold text-foreground">31.4M</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                    <div>
                      <p className="text-xs font-bold text-foreground">🏭 Sarpedon Metro</p>
                      <p className="text-[10px] text-muted-foreground">Industrial & Technology Hub</p>
                    </div>
                    <span className="text-xs font-extrabold text-foreground">22.8M</span>
                  </div>
                </div>
              </div>

              {/* Geographic stats */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-foreground">Territorial Attributes</p>
                <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex justify-between border-b border-white/5 pb-2 text-xs">
                    <span className="text-muted-foreground">Provinces / Prefectures</span>
                    <span className="font-bold text-foreground">42 Provinces</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2 text-xs">
                    <span className="text-muted-foreground">Coastline Length</span>
                    <span className="font-bold text-foreground">4,218 km</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">International Land Borders</span>
                    <span className="font-bold text-foreground">8,921 km</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 6: Governance & Law */}
          <div id="section-governance" className="scroll-mt-24">
            <StateStructureTree countryName={country.name} />
          </div>

          {/* Section 7: Foreign Affairs */}
          <div id="section-foreign" className="scroll-mt-24">
            <DiplomaticMatrixCard countryName={country.name} />
          </div>

          {/* Section 8: Defense & Security */}
          <div
            id="section-defense"
            className="facet-surface facet-refraction space-y-4 rounded-2xl border border-white/10 p-5 shadow-lg backdrop-blur-xl scroll-mt-24"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Strategic Posture
                </span>
                <h3 className="text-base font-bold tracking-tight text-foreground">
                  Defense & Military Readiness
                </h3>
              </div>
              <span className="text-xs font-bold text-red-400">Readiness: 87%</span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Active Personnel</p>
                <p className="text-sm font-extrabold text-foreground mt-0.5">2.4 Million</p>
                <p className="text-[10px] text-muted-foreground">Reserves: 3.8M</p>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Defense Budget</p>
                <p className="text-sm font-extrabold text-foreground mt-0.5">$1.8 Trillion</p>
                <p className="text-[10px] text-red-400">4.5% of GDP</p>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Fleet Strength</p>
                <p className="text-sm font-extrabold text-foreground mt-0.5">420 Capital Ships</p>
                <p className="text-[10px] text-blue-400">12 Carrier Groups</p>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Strategic Tech</p>
                <p className="text-sm font-extrabold text-foreground mt-0.5">Orbital & Cyber</p>
                <p className="text-[10px] text-purple-400">Tier 1 Capability</p>
              </div>
            </div>
          </div>

          {/* Section 9: Editorial Dossier */}
          <div
            id="section-dossier"
            className="facet-surface facet-refraction space-y-4 rounded-2xl border border-white/10 p-5 shadow-lg backdrop-blur-xl scroll-mt-24"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Knowledge & Lore
                </span>
                <h3 className="text-base font-bold tracking-tight text-foreground">
                  National Dossier (IxWiki Archive)
                </h3>
              </div>
              <Link
                href={createUrl(`/wiki/${encodeURIComponent(country.name)}`)}
                className="text-xs font-semibold text-[var(--flag-primary)] hover:underline flex items-center gap-1"
              >
                <span>Full Wiki Article</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-sm leading-relaxed text-muted-foreground">
                <p className="text-foreground font-semibold mb-1">Historical Origins & Foundation</p>
                The {country.name} represents one of the foundational sovereign powers within the realm, boasting centuries of unbroken legal continuity, architectural heritage, and diplomatic tradition.
              </div>
            </div>
          </div>

          {/* Section 10: Timeline */}
          <div
            id="section-timeline"
            className="facet-surface facet-refraction space-y-4 rounded-2xl border border-white/10 p-5 shadow-lg backdrop-blur-xl scroll-mt-24"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Chronology
                </span>
                <h3 className="text-base font-bold tracking-tight text-foreground">
                  Historical Timeline & Milestones
                </h3>
              </div>
            </div>

            <div className="relative border-l border-white/10 pl-4 space-y-4 ml-2">
              <div className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--flag-primary)] ring-4 ring-background" />
                <span className="text-[10px] font-extrabold uppercase text-[var(--flag-primary)]">2033 — Recent</span>
                <p className="text-xs font-bold text-foreground">Ratification of Strategic Alliance & Trade Accord</p>
                <p className="text-[11px] text-muted-foreground">Established comprehensive free trade zone with neighboring sovereign partners.</p>
              </div>

              <div className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-white/40 ring-4 ring-background" />
                <span className="text-[10px] font-extrabold uppercase text-muted-foreground">2031 — Milestone</span>
                <p className="text-xs font-bold text-foreground">GDP Milestone Surpasses $40 Trillion</p>
                <p className="text-[11px] text-muted-foreground">Domestic technological expansion catapults economic output to global top tier.</p>
              </div>

              <div className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-white/20 ring-4 ring-background" />
                <span className="text-[10px] font-extrabold uppercase text-muted-foreground">2028 — Epoch</span>
                <p className="text-xs font-bold text-foreground">Constitutional Modernization Act</p>
                <p className="text-[11px] text-muted-foreground">Consolidation of provincial charters into unified sovereign administrative mesh.</p>
              </div>
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
