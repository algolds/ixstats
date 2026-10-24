"use client";

import { useMemo, memo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { NavArrowUp as ChevronUp, NavArrowRight as ChevronRight } from "iconoir-react";
import { resolveChatBadgeIcon } from "~/components/ui/chat-badge-icon";
import { useUser } from "~/context/auth-context";
import { useActiveCosmetics } from "~/hooks/useActiveCosmetics";
import { api } from "~/trpc/react";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { CountryHeroCard } from "~/components/shared/country-hero/CountryHeroCard";
import { normalizeFlagUrl } from "~/lib/flags/normalization";
import { assetUrl } from "~/lib/base-path";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { AvatarGlow } from "~/components/vault/AvatarGlow";
import { NeonFrameOverlay } from "~/components/vault/NeonFrameOverlay";

const CountryMapEmbed = dynamic(
  () =>
    import("~/components/maps/widgets/CountryMapEmbed").then((m) => ({
      default: m.CountryMapEmbed,
    })),
  { ssr: false, loading: () => <Skeleton className="rounded-row h-52" /> }
);

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
  const CrownIcon = resolveChatBadgeIcon(chatBadge.icon);
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
  const { neonFrame } = useActiveCosmetics();

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

  const stats = useMemo(() => toHeroStats(country as Record<string, any>), [country]);

  if (!isSignedIn || !hasCountry || !country) return null;

  const raw = country as Record<string, any>;
  const flagUrl = assetUrl(raw.flagUrl || raw.flag || raw.newStats?.flagUrl);
  const profileSlug = stats.slug || raw.slug || countryId;

  return (
    <CountryHeroCard
      countryId={countryId}
      countryName={stats.countryName}
      flagUrl={flagUrl}
      stats={stats}
      vitalityFallback={raw}
      overlay={<NeonFrameOverlay neonFrame={neonFrame} className="rounded-card" />}
      topBar={
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
      }
      media={
        <CountryMapEmbed
          countryId={countryId}
          height="h-full"
          showNeighbors={true}
          showCities={true}
          showSubdivisions={true}
          interactive={true}
          boundsPadding={30}
        />
      }
      identity={<HeroIdentity stats={stats} profileSlug={profileSlug} flagUrl={flagUrl} />}
      action={
        // MyCountry gold scope for the tinted button.
        <span data-app="mycountry" className="contents">
          <Button asChild variant="secondary" size="sm" className="shrink-0 rounded-full">
            <Link href="/mycountry">
              <span>MyCountry</span>
              <ChevronRight />
            </Link>
          </Button>
        </span>
      }
    />
  );
}

export const DashboardHero = memo(DashboardHeroComponent);
