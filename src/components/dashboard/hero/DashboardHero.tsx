"use client";

import { useState, useMemo, memo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { NavArrowUp as ChevronUp, NavArrowRight as ChevronRight } from "iconoir-react";
import * as IconoirIcons from "iconoir-react";
import { useUser } from "~/context/auth-context";
import { usePremium } from "~/hooks/usePremium";
import { useActiveCosmetics } from "~/hooks/useActiveCosmetics";
import { api } from "~/trpc/react";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { normalizeFlagUrl } from "~/lib/flags/normalization";
import { assetUrl } from "~/lib/base-path";
import { createVitalityRingsFromCountry } from "~/components/mycountry/primitives";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { FlagWatermark } from "~/components/ui/facet/identity/FlagWatermark";
import { AvatarGlow } from "~/components/vault/AvatarGlow";
import { NeonFrameOverlay } from "~/components/vault/NeonFrameOverlay";

import { HeroSnapshotPanels, type HeroSnapshotData } from "./HeroSnapshotPanels";

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

const VITALITY_KEYS = [
  "economicVitality",
  "populationWellbeing",
  "diplomaticStanding",
  "governmentalEfficiency",
] as const;

const DETAIL_MODALS = {
  gdp: GdpDetailsModal,
  population: PopulationDetailsModal,
  government: GovernmentSpendingModal,
};

type HeroModal = keyof typeof DETAIL_MODALS | "vitality";

/** Flattens the country payload (`getByIdAtTime`) into the figures the hero shows. */
function toHeroStats(country: Record<string, any> | null | undefined) {
  const n = country?.newStats ?? {};
  return {
    countryName: country?.country ?? "",
    continent: n.continent ?? "",
    governmentType: n.governmentType ?? "",
    slug: n.slug ?? "",
    gdpPerCapita: n.currentGdpPerCapita ?? 0,
    population: n.currentPopulation ?? 0,
    currentTotalGdp: n.currentTotalGdp ?? 0,
    populationDensity: n.populationDensity ?? null,
    landArea: n.landArea ?? null,
    areaSqMi: n.areaSqMi ?? null,
    gdpGrowth: normalizeGrowth(n.realGDPGrowthRate || n.adjustedGdpGrowth),
    popGrowth: normalizeGrowth(n.populationGrowthRate),
  };
}

function HeroIdentity({
  stats,
  profileSlug,
  flagUrl,
}: {
  stats: ReturnType<typeof toHeroStats>;
  profileSlug: string;
  flagUrl: string | null | undefined;
}) {
  const { avatarGlow, chatBadge } = useActiveCosmetics();
  const CrownIcon = (IconoirIcons as Record<string, any>)[chatBadge.icon] || IconoirIcons.Crown;
  return (
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
            <CrownIcon aria-hidden className="size-4 shrink-0" style={{ color: chatBadge.color }} />
          )}
        </div>

        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          {stats.governmentType && <Badge variant="default">{stats.governmentType}</Badge>}
          {stats.continent && (
            <span className="text-label-secondary text-footnote hidden sm:inline">
              • {stats.continent}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function DashboardHeroComponent({
  onCollapsedChange,
}: {
  collapsed?: boolean;
  onCollapsedChange: (v: boolean) => void;
}) {
  const { user, isSignedIn } = useUser();
  const { isPremium } = usePremium();
  const { neonFrame } = useActiveCosmetics();
  const [activeModal, setActiveModal] = useState<HeroModal | null>(null);

  const { data: userProfile } = api.users.getProfile.useQuery(undefined, {
    enabled: !!user?.id,
    staleTime: 300_000,
  });
  const countryId = userProfile?.countryId?.trim() ?? "";
  const hasCountry = !!countryId;

  const { data: country } = api.countries.getByIdAtTime.useQuery(
    { id: countryId },
    { enabled: hasCountry, staleTime: 60_000 }
  );
  const { data: activityRingsData } = api.countries.getActivityRingsData.useQuery(
    { countryId },
    { enabled: hasCountry, staleTime: 60_000 }
  );

  const stats = useMemo(() => toHeroStats(country as Record<string, any>), [country]);
  const snapshotData: HeroSnapshotData = useMemo(
    () => ({ stats, activityRingsData: activityRingsData ?? undefined }),
    [stats, activityRingsData]
  );

  if (!isSignedIn || !hasCountry || !country) return null;

  const raw = country as Record<string, any>;
  const vitalityRings = createVitalityRingsFromCountry(
    Object.fromEntries(
      VITALITY_KEYS.map((key) => [key, (activityRingsData as any)?.[key] ?? raw[key]])
    )
  );
  const flagUrl = assetUrl(raw.flagUrl || raw.flag || raw.newStats?.flagUrl);
  const profileSlug = stats.slug || raw.slug || countryId;
  const DetailModal = activeModal && activeModal !== "vitality" ? DETAIL_MODALS[activeModal] : null;

  return (
    <Card className="overflow-hidden">
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

        <div className="bg-surface-secondary rounded-row shadow-card relative flex h-full flex-col justify-between gap-2 overflow-hidden p-3 md:col-span-2">
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-2 flex items-center justify-between gap-2">
              <HeroIdentity stats={stats} profileSlug={profileSlug} flagUrl={flagUrl} />

              {/* MyCountry gold scope for the tinted button. */}
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
      {DetailModal && (
        <DetailModal
          isOpen
          onClose={() => setActiveModal(null)}
          countryId={countryId}
          countryName={stats.countryName}
        />
      )}
      {activeModal === "vitality" && (
        <VitalityBreakdownModal
          isOpen
          onClose={() => setActiveModal(null)}
          rings={vitalityRings}
          countryName={stats.countryName}
        />
      )}
    </Card>
  );
}

export const DashboardHero = memo(DashboardHeroComponent);
