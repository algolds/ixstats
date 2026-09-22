"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import {
  OpenBook as BookOpen,
  Globe,
  Coins,
  Group as Users,
  Building,
  Shield,
  Clock,
  MapPin,
  NavArrowRight as ChevronRight,
  Quote,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { CountryPulseBanner } from "../shared/CountryPulseBanner";
import { NationalConditionMatrix } from "../shared/NationalConditionMatrix";
import { GlobalPositionRankings } from "../shared/GlobalPositionRankings";
import { QuickCompareModal } from "../shared/QuickCompareModal";
import Link from "next/link";
import { createUrl } from "~/lib/utils";

interface EditorialProfileViewProps {
  country: any;
  slug: string;
}

export function EditorialProfileView({ country, slug }: EditorialProfileViewProps) {
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  const gdpFormatted = `$${((country.currentTotalGdp || 40200000000000) / 1000000000000).toFixed(1)}T`;
  const popFormatted = `${((country.currentPopulation || 626200000) / 1000000).toFixed(1)}M`;
  const perCapitaFormatted = `$${Math.round(country.currentGdpPerCapita || 64273).toLocaleString()}`;

  return (
    <div className="space-y-8">
      {/* ── Cinematic Editorial Header ── */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-card/80 via-card/40 to-background p-8 shadow-2xl backdrop-blur-2xl">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[var(--flag-primary)]/15 blur-3xl" />

        <div className="max-w-3xl space-y-3">
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest text-[var(--flag-primary)]">
              National Chronicle & Briefing
            </span>
            <span className="text-xs text-muted-foreground">Vol. XXIV · Edition 2033</span>
          </div>

          <h1 className="font-serif text-3xl md:text-5xl font-bold tracking-tight text-foreground">
            The State of {country.name}
          </h1>

          <p className="font-serif italic text-base md:text-lg text-muted-foreground leading-relaxed">
            "Virtute et Constantia" — An authoritative intelligence dossier examining sovereign capacity, historical continuity, and contemporary geopolitical standing.
          </p>
        </div>

        {/* Narrative Pulse Pill */}
        <div className="mt-6">
          <CountryPulseBanner country={country} />
        </div>
      </div>

      {/* ── Dual Column: 65% Editorial Narrative / 35% Living Telemetry Rail ── */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Column (8 cols / 65% Width — The Editorial Stream) */}
        <div className="space-y-8 lg:col-span-8">
          {/* Chapter 1: The State of the Sovereign */}
          <article className="facet-surface facet-refraction space-y-4 rounded-3xl border border-white/10 p-6 md:p-8 shadow-xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--flag-primary)]">
                Chapter I · Geopolitical Overview
              </span>
              <span className="text-xs text-muted-foreground">Published in IxWiki Archives</span>
            </div>

            <div className="space-y-4 font-serif text-base leading-relaxed text-foreground/90">
              <p className="first-letter:float-left first-letter:mr-3 first-letter:text-5xl first-letter:font-bold first-letter:text-[var(--flag-primary)] first-letter:font-serif">
                {country.name} stands as a formidable sovereign power in the contemporary geopolitical theater, maintaining a delicate equilibrium between advanced technological infrastructure and centuries-old constitutional traditions. With a gross domestic product exceeding {gdpFormatted} and a citizen base of {popFormatted}, the nation continues to project significant institutional vitality across international arenas.
              </p>

              <blockquote className="my-6 rounded-2xl border-l-4 border-[var(--flag-primary)] bg-white/[0.03] p-5 font-serif italic text-muted-foreground">
                <Quote className="mb-2 h-5 w-5 text-[var(--flag-primary)] opacity-75" />
                "The endurance of our state lies not merely in our industrial throughput, but in the steadfast cohesion of our provincial charters and sovereign laws."
              </blockquote>

              <p>
                Urban centers such as the imperial capital have witnessed sustained demographic centralization, supported by expansive high-speed transport corridors and state-of-the-art energy grids. Domestic industrial sectors contribute substantially to regional trade stability, generating consistent foreign reserves and fiscal surpluses.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-xs font-semibold text-muted-foreground">
              <span>Source: Imperial Statistical Bureau</span>
              <Link
                href={createUrl(`/wiki/${encodeURIComponent(country.name)}`)}
                className="text-[var(--flag-primary)] hover:underline flex items-center gap-1"
              >
                <span>Read Full Article on IxWiki</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </article>

          {/* Chapter 2: Constitutional Architecture & Government */}
          <article className="facet-surface facet-refraction space-y-4 rounded-3xl border border-white/10 p-6 md:p-8 shadow-xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--flag-primary)]">
                Chapter II · Institutional Architecture
              </span>
              <span className="text-xs text-muted-foreground">Constitutional Dossier</span>
            </div>

            <h3 className="font-serif text-2xl font-bold tracking-tight text-foreground">
              The Governance & Legal Framework
            </h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 pt-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
                  <Building className="h-4 w-4" />
                </div>
                <h4 className="text-sm font-bold text-foreground">Executive Authority</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Supreme executive powers reside in the Crown and Chancery, administering state policy and international treaties.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400">
                  <BookOpen className="h-4 w-4" />
                </div>
                <h4 className="text-sm font-bold text-foreground">Imperial Assembly</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Bicameral legislature holding plenary budgetary control and statutory ratification across all 42 provinces.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
                  <Shield className="h-4 w-4" />
                </div>
                <h4 className="text-sm font-bold text-foreground">High Judiciary</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Autonomous constitutional tribunal ensuring strict fidelity to foundational civil rights and imperial charters.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-white/5 bg-black/20 p-4 text-xs text-muted-foreground">
              <p className="font-bold text-foreground mb-1">IxWiki Verification Source:</p>
              Documented under article <span className="font-semibold text-[var(--flag-primary)]">"Government of {country.name}"</span> · 14 citations · Verified by System Owners.
            </div>
          </article>

          {/* Chapter 3: Chronicle of Historical Epochs */}
          <article className="facet-surface facet-refraction space-y-6 rounded-3xl border border-white/10 p-6 md:p-8 shadow-xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--flag-primary)]">
                Chapter III · Historical Timeline
              </span>
              <span className="text-xs text-muted-foreground">Epoch Chronology</span>
            </div>

            <h3 className="font-serif text-2xl font-bold tracking-tight text-foreground">
              Chronicle of Key Sovereign Milestones
            </h3>

            <div className="relative border-l-2 border-[var(--flag-primary)]/30 pl-6 space-y-6 ml-3">
              <div className="relative">
                <span className="absolute -left-[31px] top-1.5 h-3.5 w-3.5 rounded-full bg-[var(--flag-primary)] ring-4 ring-background" />
                <span className="text-xs font-extrabold text-[var(--flag-primary)]">Anno Domini 2033</span>
                <h4 className="text-sm font-bold text-foreground mt-0.5">Grand Accord of Regional Trade</h4>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Ratified landmark multi-lateral commerce treaty establishing zero-tariff corridors across neighboring powers.
                </p>
              </div>

              <div className="relative">
                <span className="absolute -left-[31px] top-1.5 h-3.5 w-3.5 rounded-full bg-white/40 ring-4 ring-background" />
                <span className="text-xs font-extrabold text-muted-foreground">Anno Domini 2030</span>
                <h4 className="text-sm font-bold text-foreground mt-0.5">National Infrastructure Renaissance</h4>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Completion of the trans-provincial continental magnetic transit spine, linking capital metropolises with maritime harbors.
                </p>
              </div>

              <div className="relative">
                <span className="absolute -left-[31px] top-1.5 h-3.5 w-3.5 rounded-full bg-white/20 ring-4 ring-background" />
                <span className="text-xs font-extrabold text-muted-foreground">Anno Domini 2025</span>
                <h4 className="text-sm font-bold text-foreground mt-0.5">Constitutional Synthesis Convention</h4>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Unanimous adoption of modern digital sovereign governance protocols, securing privacy and economic liberties.
                </p>
              </div>
            </div>
          </article>
        </div>

        {/* Right Column (4 cols / 35% Width — Living Telemetry Intelligence Rail) */}
        <div className="space-y-6 lg:col-span-4">
          <div className="lg:sticky lg:top-20 space-y-6">
            {/* National Condition Index */}
            <NationalConditionMatrix />

            {/* Global Position Rankings */}
            <GlobalPositionRankings
              countryName={country.name}
              onOpenCompare={() => setIsCompareOpen(true)}
            />

            {/* Territory Radar Card */}
            <div className="facet-surface facet-refraction space-y-3 rounded-2xl border border-white/10 p-5 shadow-lg backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                    Geospatial Radar
                  </span>
                  <h4 className="text-sm font-bold text-foreground">Territorial Footprint</h4>
                </div>
                <MapPin className="h-4 w-4 text-[var(--flag-primary)]" />
              </div>

              <div className="space-y-2 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs">
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-muted-foreground">Total Territory</span>
                  <span className="font-bold text-foreground">7,536,963 km²</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-muted-foreground">Provinces & Territories</span>
                  <span className="font-bold text-foreground">42 Admin Regions</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Coastline Length</span>
                  <span className="font-bold text-foreground">4,218 km</span>
                </div>
              </div>

              <Link
                href={createUrl("/maps")}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-2.5 text-xs font-bold text-foreground hover:bg-white/10"
              >
                <span>Open in IxWorld Atlas</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
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
