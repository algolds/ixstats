"use client";

import { useState, useMemo, memo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Crown,
  Calendar,
  Globe,
  Tournament as Swords,
  NavArrowUp as ChevronUp,
  NavArrowRight as ChevronRight,
} from "iconoir-react";
import * as IconoirIcons from "iconoir-react";
import { useUser } from "~/context/auth-context";
import { usePremium } from "~/hooks/usePremium";
import { useActiveCosmetics } from "~/hooks/useActiveCosmetics";
import { api } from "~/trpc/react";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { normalizeFlagUrl } from "~/lib/flags/normalization";
import { assetUrl } from "~/lib/base-path";
import { createVitalityRingsFromCountry } from "~/components/mycountry/primitives";
import { SECTION_THEME_CLASSES } from "~/lib/themes";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { FlagWatermark } from "~/components/ui/facet/identity/FlagWatermark";
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
  { ssr: false, loading: () => <Skeleton className="rounded-row h-52" /> }
);

import { VitalityBreakdownModal } from "~/components/mycountry/shared/modals/VitalityBreakdownModal";
import { GdpDetailsModal } from "~/components/mycountry/shared/modals/metric-details/GdpDetailsModal";
import { PopulationDetailsModal } from "~/components/mycountry/shared/modals/metric-details/PopulationDetailsModal";
import { GovernmentSpendingModal } from "~/components/mycountry/shared/modals/metric-details/GovernmentSpendingModal";
import { Card } from "~/components/ui/card";

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
    // oxlint-disable-next-line
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

  const flagUrl = assetUrl(
    (country as any)?.flagUrl || (country as any)?.flag || (country as any)?.newStats?.flagUrl
  );
  const profileSlug =
    stats.slug || (country as any)?.slug || (country as any)?.newStats?.slug || countryId;

  return (
    // v2 (c5c6b382) glass hero (white 5% frosted fill, 15% white border, xl shadow) with a
    // top refraction hairline, the 320px flag watermark that brightens on hover, and paper grain.
    <Card variant="hero" className="overflow-hidden">
      <FlagWatermark src={flagUrl} />

      <NeonFrameOverlay neonFrame={neonFrame} className="rounded-card" />

      <div className="relative flex justify-end px-2 pt-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onCollapsedChange(true)}
          aria-label="Collapse overview"
          title="Collapse overview"
          className="text-label-secondary"
        >
          <ChevronUp />
        </Button>
      </div>

      <div className="relative grid gap-3 p-3 pt-1 md:grid-cols-5">
        <div className="border-separator rounded-row h-[220px] overflow-hidden border md:col-span-3 md:h-full md:min-h-[240px]">
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

        {/* v2 nested a frosted panel here; glass never nests, so it is the inset panel. */}
        <div className="bg-surface-secondary rounded-row shadow-card relative flex h-full flex-col justify-between gap-2 overflow-hidden p-3 md:col-span-2">
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-2 flex items-center justify-between gap-2">
              <Link
                href={`/countries/${profileSlug}`}
                className="group/title rounded-control focus-visible:outline-tint flex min-w-0 cursor-pointer items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2"
                title={`View ${stats.countryName} Profile`}
              >
                <AvatarGlow avatarGlow={avatarGlow} roundedClass="rounded-control">
                  <div className="bg-surface border-separator rounded-control ease-out-facet flex items-center justify-center overflow-hidden border p-1 transition-[scale] duration-300 group-hover/title:scale-105 group-focus-visible/title:scale-105 motion-reduce:transition-none motion-reduce:group-hover/title:scale-100 motion-reduce:group-focus-visible/title:scale-100">
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
                  <div className="flex items-center gap-2">
                    <span className="text-label text-title-3 group-hover/title:text-tint group-focus-visible/title:text-tint truncate underline-offset-2 transition-colors group-hover/title:underline group-focus-visible/title:underline">
                      {stats.countryName}
                    </span>
                    {chatBadge.enabled && (
                      <CrownIcon
                        aria-hidden
                        className="size-4 shrink-0"
                        style={{ color: chatBadge.color }}
                      />
                    )}
                  </div>

                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    {stats.governmentType && (
                      <Badge variant="default">{stats.governmentType}</Badge>
                    )}
                    {stats.continent && (
                      <span className="text-label-secondary text-footnote hidden sm:inline">
                        • {stats.continent}
                      </span>
                    )}
                  </div>
                </div>
              </Link>

              {/* v2 amber MyCountry pill: the tinted button in the MyCountry (gold) scope. */}
              <span data-app="mycountry" className="contents">
                <Button asChild variant="secondary" size="sm" className="shrink-0 rounded-full">
                  <Link href="/mycountry">
                    <span>MyCountry</span>
                    <ChevronRight />
                  </Link>
                </Button>
              </span>
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
    </Card>
  );
}

export const DashboardHero = memo(DashboardHeroComponent);
