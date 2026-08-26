"use client";

import { useState, useMemo, memo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Crown, Calendar, Globe, Tournament as Swords, NavArrowUp as ChevronUp, NavArrowRight as ChevronRight } from "iconoir-react";
import * as IconoirIcons from "iconoir-react";
import { useUser } from "~/context/auth-context";
import { usePremium } from "~/hooks/usePremium";
import { useActiveCosmetics } from "~/hooks/useActiveCosmetics";
import { api } from "~/trpc/react";
import { UnifiedCountryFlag } from "~/components/ui/UnifiedCountryFlag";
import { normalizeFlagUrl } from "~/lib/flags/normalization";
import { createVitalityRingsFromCountry } from "~/components/mycountry/primitives";
import { SECTION_THEME_CLASSES } from "~/lib/themes";
import { TextureOverlay } from "~/components/ui/texture-overlay";
// oxlint-disable-next-line eslint/no-unused-vars
import { getEconomicTierFromGdpPerCapita, getPopulationTierFromPopulation } from "~/types/ixstats";
import { AvatarGlow } from "~/components/vault/AvatarGlow";
import { NeonFrameOverlay } from "~/components/vault/NeonFrameOverlay";
import { type HeroHelpStep } from "~/components/ui/hero-help-modal";

import { HeroSnapshotPanels, type HeroSnapshotData } from "./HeroSnapshotPanels";

// oxlint-disable-next-line eslint/no-unused-vars
const DASHBOARD_HELP_STEPS: HeroHelpStep[] = [
  {
    title: "Welcome to IxStats",
    body: "This is your global dashboard — a live snapshot of your nation and the wider world. Use it to keep tabs on your standing and jump into the systems that matter.",
  },
  {
    title: "Your nation at a glance",
    body: "The hero shows your flag, leader, GDP per capita, population, land area, and momentum (growth + global rank). The map highlights your territory and capital.",
  },
  {
    title: "Switch perspectives",
    body: "Use the Overview, Agenda, Diplomacy, and Defense tabs to see different slices of your nation right from the dashboard.",
  },
  {
    title: "Explore the world",
    body: "From the nav you can browse global rankings and stats, the interactive world map, ThinkPages social feeds, and the IxVault marketplace.",
  },
  {
    title: "Run your country",
    body: "Click “Go to MyCountry” to enter your command suite — hold cabinet meetings, enact policies, resolve national issues, and edit your nation.",
  },
];

// oxlint-disable-next-line eslint/no-unused-vars
const HERO_NAV = [
  {
    section: "Overview" as const,
    icon: Crown,
    label: "Overview",
    theme: SECTION_THEME_CLASSES.overview,
  },
  {
    section: "Agenda" as const,
    icon: Calendar,
    label: "Agenda",
    theme: SECTION_THEME_CLASSES.executive,
  },
  {
    section: "Diplomacy" as const,
    icon: Globe,
    label: "Diplomacy",
    theme: SECTION_THEME_CLASSES.diplomacy,
  },
  {
    section: "Defense" as const,
    icon: Swords,
    label: "Defense",
    theme: SECTION_THEME_CLASSES.defense,
  },
] as const;

const CountryMapEmbed = dynamic(
  () =>
    import("~/components/maps/widgets/CountryMapEmbed").then((m) => ({
      default: m.CountryMapEmbed,
    })),
  { ssr: false, loading: () => <div className="bg-muted h-52 animate-pulse rounded-xl" /> }
);

import { VitalityBreakdownModal } from "~/components/ui/modals/VitalityBreakdownModal";
import { GdpDetailsModal } from "~/components/ui/modals/GdpDetailsModal";
import { PopulationDetailsModal } from "~/components/ui/modals/PopulationDetailsModal";
import { GovernmentSpendingModal } from "~/components/ui/modals/metric-details/GovernmentSpendingModal";

function normalizeGrowth(value: number | null | undefined): number {
  if (!value || !isFinite(value)) return 0;
  let v = value;
  while (Math.abs(v) > 50) v /= 100;
  return Math.min(20, Math.max(-20, v));
}

export function DashboardHeroComponent({
  onCollapsedChange,
}: {
  collapsed?: boolean;
  onCollapsedChange: (v: boolean) => void;
}) {
  const { user, isSignedIn } = useUser();
  const { isPremium } = usePremium();
  const { avatarGlow, chatBadge, neonFrame } = useActiveCosmetics();
  const CrownIcon = (IconoirIcons as Record<string, any>)[chatBadge.icon] || IconoirIcons.Crown;

  const [activeModal, setActiveModal] = useState<
    "gdp" | "population" | "government" | "vitality" | null
  >(null);

  const { data: userProfile } = api.users.getProfile.useQuery(undefined, {
    enabled: !!user?.id,
    staleTime: 300_000,
  });
  const countryId = userProfile?.countryId || "";
  const hasCountry = !!countryId && countryId.trim() !== "";

  const { data: country } = api.countries.getByIdAtTime.useQuery(
    { id: countryId },
    { enabled: hasCountry, staleTime: 60_000 }
  );
  // oxlint-disable-next-line eslint/no-unused-vars
  const { data: rankings } = api.mycountry.getRankings.useQuery(
    { countryId },
    { enabled: hasCountry, staleTime: 300_000 }
  );
  const { data: activityRingsData } = api.countries.getActivityRingsData.useQuery(
    { countryId },
    { enabled: hasCountry, staleTime: 60_000 }
  );

  const vitalityRings = createVitalityRingsFromCountry({
    economicVitality:
      (activityRingsData as any)?.economicVitality ?? (country as any)?.economicVitality,
    populationWellbeing:
      (activityRingsData as any)?.populationWellbeing ?? (country as any)?.populationWellbeing,
    diplomaticStanding:
      (activityRingsData as any)?.diplomaticStanding ?? (country as any)?.diplomaticStanding,
    governmentalEfficiency:
      (activityRingsData as any)?.governmentalEfficiency ??
      (country as any)?.governmentalEfficiency,
  });
  const newStats = (country as Record<string, any>)?.newStats ?? {};
  const stats = useMemo(
    () => ({
      tier: newStats.economicTier ?? "—",
      countryName: (country as Record<string, any>)?.country ?? "",
      leader: newStats.leader ?? "",
      continent: newStats.continent ?? "",
      governmentType: newStats.governmentType ?? "",
      slug: newStats.slug ?? "",
      gdpPerCapita: newStats.currentGdpPerCapita ?? 0,
      population: newStats.currentPopulation ?? 0,
      populationTier: newStats.populationTier ?? "1",
      currentTotalGdp: newStats.currentTotalGdp ?? 0,
      economicTier: newStats.economicTier ?? "Developing",
      populationDensity: newStats.populationDensity ?? null,
      landArea: newStats.landArea ?? null,
      areaSqMi: newStats.areaSqMi ?? null,
      gdpGrowth: normalizeGrowth(newStats.realGDPGrowthRate || newStats.adjustedGdpGrowth),
      popGrowth: normalizeGrowth(newStats.populationGrowthRate),
      maxGdpGrowthRate: newStats.maxGdpGrowthRate ?? 0,
    }),
    [newStats, country]
  );

  const snapshotData: HeroSnapshotData = useMemo(
    () => ({
      stats,
      activityRingsData: activityRingsData ?? undefined,
    }),
    [stats, activityRingsData]
  );

  if (!isSignedIn || !hasCountry || !country) return null;

  const flagUrl =
    (country as any)?.flagUrl || (country as any)?.flag || (country as any)?.newStats?.flagUrl;
  const profileSlug =
    stats.slug || (country as any)?.slug || (country as any)?.newStats?.slug || countryId;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/15 bg-white/[0.05] shadow-xl backdrop-blur-2xl before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent dark:border-white/10 dark:bg-black/35">
      {/* Cinematic Background Flag Watermark Scrim */}
      {flagUrl && (
        <div className="pointer-events-none absolute -top-12 -right-12 h-80 w-80 overflow-hidden opacity-[0.14] transition-all duration-700 select-none group-hover:scale-105 group-hover:opacity-[0.25] dark:opacity-[0.18]">
          <img
            src={flagUrl}
            alt=""
            className="h-full w-full rounded-full object-cover object-center mix-blend-luminosity blur-[1px] filter dark:mix-blend-normal"
          />
          <div className="via-card/75 to-card absolute inset-0 bg-gradient-to-l from-transparent" />
        </div>
      )}

      <NeonFrameOverlay neonFrame={neonFrame} className="rounded-2xl" />
      <TextureOverlay texture="paperGrain" opacity={0.07} />

      <button
        onClick={() => onCollapsedChange(true)}
        className="text-muted-foreground hover:bg-muted/30 relative z-10 flex w-full cursor-pointer items-center justify-end px-4 py-1.5 text-[10px] transition-colors"
      >
        <ChevronUp className="h-3 w-3 shrink-0" />
      </button>

      <div className="relative z-10 grid gap-2.5 p-3 pt-1 md:grid-cols-5">
        <div className="border-border/30 h-[220px] overflow-hidden rounded-xl border md:col-span-3 md:h-full md:min-h-[240px]">
          <CountryMapEmbed
            countryId={countryId}
            height="h-full"
            showNeighbors={true}
            showCities={true}
            showSubdivisions={true}
            interactive={true}
            boundsPadding={30}
          />
        </div>

        <div className="relative z-10 flex h-full flex-col justify-between gap-2 overflow-hidden rounded-xl border border-white/10 bg-white/[0.06] p-2.5 shadow-sm backdrop-blur-md md:col-span-2 dark:border-white/10 dark:bg-black/25">
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-2 flex items-center justify-between gap-2">
              <Link
                href={`/countries/${profileSlug}`}
                className="group/title flex min-w-0 cursor-pointer items-center gap-2.5"
                title={`View ${stats.countryName} Profile`}
              >
                <AvatarGlow avatarGlow={avatarGlow} roundedClass="rounded-lg" className="shadow-md">
                  <div className="flex items-center justify-center overflow-hidden rounded-lg border border-white/20 bg-white/10 p-1 shadow-sm backdrop-blur-md transition-transform duration-300 group-hover/title:scale-105">
                    <UnifiedCountryFlag
                      showTooltip={false}
                      countryName={stats.countryName}
                      flagUrl={normalizeFlagUrl(flagUrl)}
                      size="lg"
                      className="shrink-0 rounded-xs"
                    />
                  </div>
                </AvatarGlow>

                <div className="flex min-w-0 flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-foreground truncate text-base font-bold tracking-tight transition-colors group-hover/title:text-amber-400 group-hover/title:underline sm:text-lg">
                      {stats.countryName}
                    </span>
                    {chatBadge.enabled && (
                      <CrownIcon className="h-4 w-4 shrink-0" style={{ color: chatBadge.color }} />
                    )}
                  </div>

                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    {stats.governmentType && (
                      <span className="text-muted-foreground/90 rounded-md border border-white/15 bg-white/[0.08] px-1.5 py-0.5 text-[8px] font-semibold tracking-wider uppercase backdrop-blur-md">
                        {stats.governmentType}
                      </span>
                    )}
                    {stats.continent && (
                      <span className="text-muted-foreground/70 hidden text-[9px] font-normal sm:inline">
                        • {stats.continent}
                      </span>
                    )}
                  </div>
                </div>
              </Link>

              <Link
                href="/mycountry"
                className="group/btn flex shrink-0 cursor-pointer items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 text-[9px] font-semibold text-amber-700 shadow-xs backdrop-blur-md transition-all duration-200 hover:border-amber-500/60 hover:bg-amber-500/25 active:scale-95 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:border-amber-400/50 dark:hover:bg-amber-500/20"
              >
                <span>MyCountry</span>
                <ChevronRight className="h-3 w-3 shrink-0 text-amber-700 transition-transform duration-200 group-hover/btn:translate-x-0.5 dark:text-amber-300" />
              </Link>
            </div>

            <div className="min-h-0 flex-1">
              <HeroSnapshotPanels
                isPremium={isPremium}
                data={snapshotData}
                countryId={countryId}
                onOpenModal={setActiveModal}
              />
            </div>
          </div>
        </div>
      </div>
      {activeModal === "gdp" && (
        <GdpDetailsModal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          countryId={countryId}
          countryName={stats.countryName}
        />
      )}
      {activeModal === "population" && (
        <PopulationDetailsModal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          countryId={countryId}
          countryName={stats.countryName}
        />
      )}
      {activeModal === "government" && (
        <GovernmentSpendingModal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          countryId={countryId}
          countryName={stats.countryName}
        />
      )}
      {activeModal === "vitality" && (
        <VitalityBreakdownModal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          rings={vitalityRings}
          countryName={stats.countryName}
        />
      )}
    </div>
  );
}

export const DashboardHero = memo(DashboardHeroComponent);
