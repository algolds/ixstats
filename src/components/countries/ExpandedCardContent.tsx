"use client";

import React from "react";
import { AnimatePresence } from "motion/react";
import { HealthRing } from "~/components/ui/health-ring";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { FadeIn } from "~/components/ui/text-reveal";
import { Spotlight } from "~/components/ui/spotlight-new";
import { TrendingUpIcon } from "~/components/ui/trending-up";
import { ActivityIcon } from "~/components/ui/activity";
import { LayersIcon } from "~/components/ui/layers";
import {
  RiMapPin2Line,
  RiBarChartLine,
  RiMoneyDollarCircleLine,
  RiAwardLine,
  RiGovernmentLine,
  RiUserStarLine,
  RiGlobalLine,
  RiHeartPulseLine,
} from "react-icons/ri";
import { type CountryCardData } from "./CountryFocusCard";
import { ExpandedCardActions } from "./ExpandedCardActions";

interface ExpandedCardContentProps {
  country: CountryCardData;
  economicScore: number;
  populationScore: number;
  developmentScore: number;
  viewerCountryId?: string;
  isOwnCountry: boolean;
  onCountryClick?: (countryId: string, countryName: string) => void;
}

export const ExpandedCardContent = React.memo<ExpandedCardContentProps>(
  ({
    country,
    economicScore,
    populationScore,
    developmentScore,
    viewerCountryId,
    isOwnCountry,
    onCountryClick,
  }) => {
    const countrySlug = country.slug || country.name.replace(/\s+/g, "_");

    return (
      <div className="relative overflow-hidden border-t border-white/20 bg-black/75 backdrop-blur-xl">
        <AnimatePresence>
          <Spotlight
            gradientFirst="radial-gradient(68.54% 68.72% at 55.02% 31.46%, hsla(220, 100%, 85%, .12) 0, hsla(220, 100%, 65%, .04) 50%, hsla(220, 100%, 55%, 0) 80%)"
            gradientSecond="radial-gradient(50% 50% at 50% 50%, hsla(200, 100%, 85%, .08) 0, hsla(200, 100%, 65%, .03) 80%, transparent 100%)"
            gradientThird="radial-gradient(50% 50% at 50% 50%, hsla(240, 100%, 85%, .06) 0, hsla(240, 100%, 55%, .02) 80%, transparent 100%)"
            translateY={-200}
            width={300}
            height={600}
            smallWidth={120}
            duration={12}
            xOffset={50}
          />
        </AnimatePresence>

        <div className="relative z-10 space-y-3 px-4 py-4">
          {/* Header: title + location pills inline */}
          <FadeIn direction="up" delay={0.1}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold tracking-wide text-white/70 uppercase">
                Intelligence Brief
              </span>
              {country.continent && (
                <span className="rounded-full border border-white/15 bg-white/10 px-2 py-px text-[10px] font-medium text-white/75">
                  {country.continent}
                </span>
              )}
              {country.region && (
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-px text-[10px] text-white/55">
                  {country.region}
                </span>
              )}
            </div>
          </FadeIn>

          {/* Health Rings — compact row */}
          <div className="grid grid-cols-3 gap-2">
            <FadeIn direction="up" delay={0.15} className="text-center">
              <div className="relative mx-auto w-fit">
                <HealthRing
                  value={economicScore}
                  size={40}
                  color="rgba(34, 197, 94, 0.8)"
                  label=""
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <RiMoneyDollarCircleLine className="h-3 w-3 text-green-400" />
                </div>
              </div>
              <div className="mt-1 text-[10px] font-medium text-white/80">Economy</div>
              <div className="text-[10px] text-white/60">
                <NumberFlowDisplay
                  value={economicScore}
                  format="percentage"
                  decimalPlaces={0}
                  className=""
                />
              </div>
            </FadeIn>

            <FadeIn direction="up" delay={0.2} className="text-center">
              <div className="relative mx-auto w-fit">
                <HealthRing
                  value={populationScore}
                  size={40}
                  color="rgba(59, 130, 246, 0.8)"
                  label=""
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <TrendingUpIcon size={14} className="text-blue-400" />
                </div>
              </div>
              <div className="mt-1 text-[10px] font-medium text-white/80">Growth</div>
              <div className="text-[10px] text-white/60">
                {country.adjustedGdpGrowth ? (
                  <NumberFlowDisplay
                    value={country.adjustedGdpGrowth * 100}
                    format="percentage"
                    decimalPlaces={1}
                    className=""
                  />
                ) : (
                  "N/A"
                )}
              </div>
            </FadeIn>

            <FadeIn direction="up" delay={0.25} className="text-center">
              <div className="relative mx-auto w-fit">
                <HealthRing
                  value={developmentScore}
                  size={40}
                  color="rgba(168, 85, 247, 0.8)"
                  label=""
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <ActivityIcon size={14} className="text-purple-400" />
                </div>
              </div>
              <div className="mt-1 text-[10px] font-medium text-white/80">Development</div>
              <div className="text-[10px] text-white/60">
                <NumberFlowDisplay
                  value={developmentScore}
                  format="percentage"
                  decimalPlaces={0}
                  className=""
                />
              </div>
            </FadeIn>
          </div>

          {/* 2-Column Detail Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* LEFT: Identity & Governance */}
            <FadeIn direction="left" delay={0.3} className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-white/90">
                <RiGovernmentLine className="h-3 w-3 text-amber-400" />
                <span className="text-[10px] font-semibold tracking-wide uppercase antialiased">
                  Governance
                </span>
              </div>
              <div className="space-y-1 pl-0.5">
                {country.governmentType && (
                  <DetailRow label="Govt" value={country.governmentType} />
                )}
                {country.leader && <DetailRow label="Leader" value={country.leader} />}
                {country.religion && <DetailRow label="Religion" value={country.religion} />}
                {country.populationTier && (
                  <div className="flex justify-between text-[11px] text-white/80">
                    <span>Pop. Tier</span>
                    <div className="flex items-center gap-1">
                      <LayersIcon size={10} className="text-cyan-400" />
                      <span className="font-medium">{country.populationTier}</span>
                    </div>
                  </div>
                )}
                <div className="flex justify-between text-[11px] text-white/80">
                  <span>Econ Tier</span>
                  <div className="flex items-center gap-1">
                    <RiAwardLine className="h-2.5 w-2.5 text-yellow-400" />
                    <span className="font-medium">{country.economicTier}</span>
                  </div>
                </div>
              </div>
            </FadeIn>

            {/* RIGHT: Key Indicators */}
            <FadeIn direction="right" delay={0.35} className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-white/90">
                <RiHeartPulseLine className="h-3 w-3 text-rose-400" />
                <span className="text-[10px] font-semibold tracking-wide uppercase antialiased">
                  Indicators
                </span>
              </div>
              <div className="space-y-1 pl-0.5">
                {country.unemploymentRate != null && (
                  <IndicatorRow label="Unemploy." value={country.unemploymentRate} suffix="%" />
                )}
                {country.inflationRate != null && (
                  <IndicatorRow label="Inflation" value={country.inflationRate * 100} suffix="%" />
                )}
                {country.lifeExpectancy != null && (
                  <IndicatorRow
                    label="Life Exp."
                    value={country.lifeExpectancy}
                    suffix=" yrs"
                    decimalPlaces={0}
                  />
                )}
                {country.literacyRate != null && (
                  <IndicatorRow label="Literacy" value={country.literacyRate} suffix="%" />
                )}
                {country.totalDebtGDPRatio != null && (
                  <IndicatorRow label="Debt/GDP" value={country.totalDebtGDPRatio} suffix="%" />
                )}
                {country.povertyRate != null && (
                  <IndicatorRow label="Poverty" value={country.povertyRate} suffix="%" />
                )}
              </div>
            </FadeIn>
          </div>

          {/* Compact Geography Row */}
          <FadeIn direction="up" delay={0.4}>
            <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              {country.landArea != null && (
                <CompactStat
                  icon={<RiMapPin2Line className="h-2.5 w-2.5 text-orange-400" />}
                  label="Area"
                >
                  <NumberFlowDisplay
                    value={Math.round(country.landArea)}
                    suffix=" km²"
                    className=""
                  />
                </CompactStat>
              )}
              {country.populationDensity != null && (
                <CompactStat
                  icon={<RiUserStarLine className="h-2.5 w-2.5 text-blue-400" />}
                  label="Density"
                >
                  <NumberFlowDisplay
                    value={Math.round(country.populationDensity)}
                    suffix="/km²"
                    className=""
                  />
                </CompactStat>
              )}
              {country.gdpDensity != null && (
                <CompactStat
                  icon={<RiBarChartLine className="h-2.5 w-2.5 text-green-400" />}
                  label="GDP/km²"
                >
                  <NumberFlowDisplay
                    value={country.gdpDensity / 1e6}
                    prefix="$"
                    suffix="M"
                    decimalPlaces={1}
                    className=""
                  />
                </CompactStat>
              )}
              {country.realGDPGrowthRate != null && (
                <CompactStat
                  icon={<RiGlobalLine className="h-2.5 w-2.5 text-emerald-400" />}
                  label="Growth"
                >
                  <NumberFlowDisplay
                    value={country.realGDPGrowthRate * 100}
                    format="percentage"
                    decimalPlaces={1}
                    trend={country.realGDPGrowthRate > 0 ? "up" : "down"}
                    className=""
                  />
                </CompactStat>
              )}
            </div>
          </FadeIn>

          {/* Quick Action Bar */}
          <FadeIn direction="up" delay={0.45} className="border-t border-white/10 pt-3">
            <ExpandedCardActions
              countryId={country.id}
              countryName={country.name}
              countrySlug={countrySlug}
              viewerCountryId={viewerCountryId}
              isOwnCountry={isOwnCountry}
              onCountryClick={onCountryClick}
            />
          </FadeIn>
        </div>
      </div>
    );
  }
);

ExpandedCardContent.displayName = "ExpandedCardContent";

// --- Helper sub-components ---

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-1.5 text-[11px] text-white/80">
      <span className="shrink-0">{label}</span>
      <span className="min-w-0 text-right leading-tight font-medium break-words">{value}</span>
    </div>
  );
}

function IndicatorRow({
  label,
  value,
  suffix = "",
  decimalPlaces = 1,
}: {
  label: string;
  value: number;
  suffix?: string;
  decimalPlaces?: number;
}) {
  return (
    <div className="flex justify-between text-[11px] text-white/80">
      <span>{label}</span>
      <span className="font-medium">
        <NumberFlowDisplay
          value={value}
          decimalPlaces={decimalPlaces}
          suffix={suffix}
          className=""
        />
      </span>
    </div>
  );
}

function CompactStat({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1">
      {icon}
      <span className="text-[9px] text-white/50">{label}</span>
      <span className="text-[10px] font-medium text-white/85">{children}</span>
    </div>
  );
}
