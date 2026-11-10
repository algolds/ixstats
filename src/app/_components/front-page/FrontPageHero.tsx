"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Coins,
  Compass,
  Crown,
  Globe,
  Map as MapIcon,
  NavArrowRight,
  TriangleFlag,
} from "iconoir-react";
import {
  CoordinatesMapEmbed,
  type EmbedPoliticalFeature,
} from "~/components/maps/widgets/CoordinatesMapEmbed";
import { RealmAvatar } from "~/components/realms/RealmAvatar";
import { FacetMaterial } from "~/components/ui/facet";
import { Badge } from "~/components/ui/badge";
import { Button, hitSlop } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { useFlag } from "~/hooks/useUnifiedFlags";
import { assetUrl } from "~/lib/base-path";
import { flatWorldCoverZoom } from "~/lib/maps/flat-projection";
import { coveredRight } from "~/lib/maps/panel-inset";
import { formatCurrency } from "~/lib/utils";
import { cn } from "~/lib/utils/cn";
import { api, type RouterOutputs } from "~/trpc/react";
import { PlatformTopBar } from "./PlatformTopBar";

type FrontPageData = RouterOutputs["frontPage"]["get"];
export type FeaturedRealmItem = NonNullable<FrontPageData["featured"]>;

/** Telemetry cells modelled on HeroSnapshotPanels: hover wash, icon tint, and tactile press. */
const SNAPSHOT_CELL =
  "group facet-press facet-press-sm hover:bg-fill-4 rounded-control focus-visible:outline-tint flex min-w-0 cursor-pointer items-center gap-2 px-2.5 py-1.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2";

const ICON_TINT =
  "transition-colors duration-fast group-hover:text-label group-focus-visible:text-label";

interface MapStageFit {
  zoom: number | null;
  insetRight: number;
}

/**
 * Fits the world to the part of the map the realm panel leaves uncovered (once, when the page is
 * idle), then keeps the covered width current as either box resizes.
 */
function useMapStageFit(
  box: React.RefObject<HTMLDivElement | null>,
  panel: React.RefObject<HTMLElement | null>
): MapStageFit {
  const [fit, setFit] = useState<MapStageFit>({ zoom: null, insetRight: 0 });
  useEffect(() => {
    const measureInset = () =>
      coveredRight(
        box.current?.getBoundingClientRect() ?? null,
        panel.current?.getBoundingClientRect() ?? null
      );
    const fitWorld = () => {
      const insetRight = measureInset();
      const w = Math.max((box.current?.clientWidth ?? 512) - insetRight, 256);
      const h = Math.max(box.current?.clientHeight ?? 320, 200);
      setFit({ zoom: flatWorldCoverZoom(w, h), insetRight });
    };
    const observer = new ResizeObserver(() => {
      const insetRight = measureInset();
      setFit((prev) => (prev.insetRight === insetRight ? prev : { ...prev, insetRight }));
    });
    for (const el of [box.current, panel.current]) if (el) observer.observe(el);
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(fitWorld, { timeout: 2000 });
      return () => {
        window.cancelIdleCallback(id);
        observer.disconnect();
      };
    }
    const id = setTimeout(fitWorld, 200);
    return () => {
      clearTimeout(id);
      observer.disconnect();
    };
  }, [box, panel]);
  return fit;
}

function HeroMapStage({
  realm,
  nations,
  panel,
  className,
}: {
  realm: FeaturedRealmItem | undefined;
  nations: FrontPageData["nations"];
  /** The realm panel floating over the map's right side. */
  panel: React.RefObject<HTMLElement | null>;
  className?: string;
}) {
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const { zoom, insetRight } = useMapStageFit(box, panel);
  const [hoveredCountry, setHoveredCountry] = useState<EmbedPoliticalFeature | null>(null);

  const { data: realmCountries } = api.countries.getSelectList.useQuery(
    { realm: realm?.slug, limit: 250 },
    { enabled: Boolean(realm?.slug), staleTime: 10 * 60 * 1000 }
  );

  const matchedCountry = hoveredCountry
    ? (nations.find(
        (n) =>
          (hoveredCountry.countryId && n.id === hoveredCountry.countryId) ||
          n.name.toLowerCase() === hoveredCountry.displayName.toLowerCase()
      ) ??
      realmCountries?.find(
        (c) =>
          (hoveredCountry.countryId && c.id === hoveredCountry.countryId) ||
          c.name.toLowerCase() === hoveredCountry.displayName.toLowerCase()
      ))
    : undefined;

  const isClaimedHover = Boolean(matchedCountry?.id || hoveredCountry?.countryId);
  const { flagUrl: fallbackFlagUrl, isPlaceholder } = useFlag(
    hoveredCountry && isClaimedHover && !matchedCountry?.flagUrl
      ? hoveredCountry.displayName
      : undefined,
    realm?.slug
  );
  const hoveredFlagUrl = matchedCountry?.flagUrl ?? (!isPlaceholder ? fallbackFlagUrl : null);

  const handleCountryHover = (next: EmbedPoliticalFeature | null) => {
    setHoveredCountry((prev) => {
      if (!prev && !next) return prev;
      if (
        prev &&
        next &&
        prev.displayName === next.displayName &&
        prev.countryId === next.countryId &&
        prev.fillColor === next.fillColor
      ) {
        return prev;
      }
      return next;
    });
  };

  const handleCountryClick = (country: EmbedPoliticalFeature) => {
    if (country.countryId) {
      const match =
        nations.find((n) => n.id === country.countryId) ??
        realmCountries?.find((c) => c.id === country.countryId);
      const slugOrId = match?.slug || country.countryId;
      router.push(`/countries/${encodeURIComponent(slugOrId)}`);
      return;
    }
    const params = new URLSearchParams();
    if (realm?.slug) params.set("realm", realm.slug);
    params.set("name", country.displayName);
    params.set("lat", country.centroidLat.toFixed(2));
    params.set("lng", country.centroidLng.toFixed(2));
    params.set("zoom", "4");
    router.push(`/maps?${params.toString()}`);
  };

  return (
    <div
      ref={box}
      data-content="visualization"
      className={cn(
        "border-separator rounded-row relative h-[260px] overflow-hidden border md:h-full md:min-h-[320px]",
        className
      )}
    >
      {realm && zoom !== null ? (
        <CoordinatesMapEmbed
          realm={realm.slug}
          lat={20}
          lng={0}
          zoom={zoom}
          marker={false}
          options="height=100%"
          insetRight={insetRight}
          className="absolute inset-0 rounded-none border-0"
          onCountryHover={handleCountryHover}
          onCountryClick={handleCountryClick}
        />
      ) : realm?.thumbnail ? (
        <img
          src={assetUrl(realm.thumbnail) ?? ""}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <Skeleton className="absolute inset-0 rounded-none" />
      )}

      {realm && (
        <div className="facet-chrome rounded-control-sm absolute right-3 bottom-3 left-3 flex flex-wrap items-center justify-between gap-2.5 px-3 py-1.5 sm:right-auto">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-5 shrink-0 items-center justify-center">
              {hoveredCountry ? (
                hoveredFlagUrl ? (
                  <img
                    src={assetUrl(hoveredFlagUrl) ?? ""}
                    alt=""
                    className="border-separator h-3.5 w-5 shrink-0 rounded-xs border object-cover"
                  />
                ) : (
                  <TriangleFlag aria-hidden className="text-tint size-4 shrink-0" />
                )
              ) : (
                <RealmAvatar thumbnail={realm.thumbnail} className="size-5" />
              )}
            </span>
            {hoveredCountry ? (
              <span className="text-footnote text-label truncate font-medium">
                {hoveredCountry.displayName}
              </span>
            ) : (
              <Link
                href={`/r/${encodeURIComponent(realm.slug)}`}
                className={cn(
                  "text-footnote text-label relative truncate font-medium hover:underline",
                  hitSlop
                )}
              >
                {realm.name}
              </Link>
            )}
          </div>
          {hoveredCountry ? (
            <span className="text-footnote text-tint-ink inline-flex shrink-0 items-center gap-0.5 font-medium">
              {hoveredCountry.countryId ? "View nation" : "Inspect in Atlas"}
              <NavArrowRight aria-hidden className="size-3.5" />
            </span>
          ) : (
            <Link
              href={`/maps?realm=${encodeURIComponent(realm.slug)}`}
              className={cn(
                "text-footnote text-tint-ink relative inline-flex shrink-0 items-center gap-0.5 font-medium hover:underline",
                hitSlop
              )}
            >
              Open in Atlas
              <NavArrowRight aria-hidden className="size-3.5" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function RealmHeroIdentity({ realm }: { realm: FeaturedRealmItem | undefined }) {
  const foundedYear = realm?.foundedAt ? new Date(realm.foundedAt).getUTCFullYear() : null;

  if (!realm) {
    return (
      <div className="flex min-w-0 items-center gap-2.5">
        <Skeleton className="rounded-control size-11 shrink-0" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    );
  }

  return (
    <Link
      href={`/r/${encodeURIComponent(realm.slug)}`}
      className="group/title rounded-control focus-visible:outline-tint flex min-w-0 cursor-pointer items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-2"
      title={`Visit ${realm.name}`}
    >
      <div className="bg-surface border-separator group-hover/title:border-tint/40 rounded-control duration-fast flex size-11 shrink-0 items-center justify-center overflow-hidden border p-1 transition-colors">
        <RealmAvatar thumbnail={realm.thumbnail} className="size-full" />
      </div>

      <div className="flex min-w-0 flex-col">
        <h2 className="text-label text-title-3 group-hover/title:text-tint duration-fast truncate transition-colors group-hover/title:underline">
          {realm.name}
        </h2>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <Badge variant="default">Featured realm</Badge>
          {foundedYear && (
            <span className="text-label-secondary text-footnote tabular-nums">
              {`· Est. ${foundedYear}`}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

/**
 * FrontPageHero — DashboardHero (CountryHeroCard + HeroSnapshotPanels) adapted for the signed-out
 * front page: a compact IxStates platform top bar above a 5-column split card where Eurth owns
 * both the 3-column interactive map stage and the 2-column snapshot well (identity, description,
 * 3-cell realm telemetry, 2×2 leading powers grid, and 2-column footer).
 */
export function FrontPageHero({
  realm,
  nations,
  facts,
  isLoading,
}: {
  realm: FeaturedRealmItem | undefined;
  nations: FrontPageData["nations"];
  facts: FrontPageData["facts"] | undefined;
  isLoading?: boolean;
}) {
  const realmPanel = useRef<HTMLDivElement>(null);
  const topNations = nations.slice(0, 4);
  const topGdpSum = nations.reduce((sum, n) => sum + (n.currentTotalGdp || 0), 0);

  const realmHeadline = [
    {
      href: realm ? `/countries?realm=${encodeURIComponent(realm.slug)}` : "/countries",
      icon: Crown,
      tone: "text-yellow",
      label: "Nations",
      value: realm ? realm.nationCount.toLocaleString() : "–",
    },
    {
      href: realm ? `/r/${encodeURIComponent(realm.slug)}/nations` : "/realms",
      icon: Compass,
      tone: "text-green",
      label: "Open claims",
      value: realm
        ? realm.openNationCount > 0
          ? `${realm.openNationCount.toLocaleString()} open`
          : "Browse"
        : "–",
    },
    {
      href: realm ? `/countries?realm=${encodeURIComponent(realm.slug)}` : "/countries",
      icon: Coins,
      tone: "text-teal",
      label: "Top GDP",
      value: topGdpSum > 0 ? formatCurrency(topGdpSum) : "–",
    },
  ] as const;

  return (
    <Card className="scroll-dissolve relative overflow-hidden">
      <PlatformTopBar facts={facts} />

      {/* From md up the map fills the row and the realm panel floats over its right side in the
          same grid cell, so the Lens has the map under it to show through and bend. Phones stack. */}
      <div className="relative grid gap-3 p-3 md:grid-cols-5">
        <HeroMapStage
          realm={realm}
          nations={nations}
          panel={realmPanel}
          className="md:col-span-5 md:col-start-1 md:row-start-1"
        />

        <FacetMaterial
          ref={realmPanel}
          layer="lens"
          className="facet-lens-frosted rounded-row flex h-full flex-col gap-2.5 overflow-hidden p-3 md:col-span-2 md:col-start-4 md:row-start-1 md:m-3 md:h-auto"
        >
          <div className="flex items-start justify-between gap-2">
            <RealmHeroIdentity realm={realm} />
            {realm && (
              <Button asChild variant="secondary" size="sm" className="shrink-0 rounded-full">
                <Link href={`/r/${encodeURIComponent(realm.slug)}`}>
                  <span>Visit realm</span>
                  <NavArrowRight aria-hidden />
                </Link>
              </Button>
            )}
          </div>

          {realm?.description && (
            <p className="text-footnote text-label-secondary line-clamp-2">{realm.description}</p>
          )}

          <div className="rounded-row border-separator flex min-h-0 flex-1 flex-col overflow-hidden border">
            <div className="divide-separator grid grid-cols-3 divide-x p-2">
              {realmHeadline.map(({ href, icon: Icon, tone, label, value }) => (
                <Link key={label} href={href} className={SNAPSHOT_CELL}>
                  <Icon aria-hidden className={cn(tone, "size-4 shrink-0", ICON_TINT)} />
                  <span className="min-w-0">
                    <span className="text-label-secondary text-caption block truncate">
                      {label}
                    </span>
                    <span className="text-label text-caption sm:text-headline block truncate tabular-nums group-hover:underline">
                      {value}
                    </span>
                  </span>
                </Link>
              ))}
            </div>

            <div className="border-separator flex flex-1 flex-col justify-center border-t p-2">
              {isLoading ? (
                <div className="grid grid-cols-2 gap-2">
                  {[0, 1, 2, 3].map((idx) => (
                    <Skeleton key={idx} className="rounded-control h-12" />
                  ))}
                </div>
              ) : topNations.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {topNations.map((nation) => (
                    <Link
                      key={nation.id}
                      href={`/countries/${encodeURIComponent(nation.slug ?? nation.id)}`}
                      className="bg-fill-4 hover:bg-fill-3 rounded-control facet-press focus-visible:outline-tint group duration-fast flex items-center gap-2 p-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                      title={`${nation.name} (${nation.economicTier})`}
                    >
                      {nation.flagUrl ? (
                        <img
                          src={assetUrl(nation.flagUrl) ?? undefined}
                          alt=""
                          width={24}
                          height={16}
                          className="rounded-control-sm h-4 w-6 shrink-0 object-cover"
                        />
                      ) : (
                        <span className="bg-fill-3 rounded-control-sm inline-flex h-4 w-6 shrink-0 items-center justify-center">
                          <TriangleFlag aria-hidden className="text-tint size-3" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="text-label text-caption block truncate font-medium group-hover:underline">
                          {nation.name}
                        </span>
                        <span className="text-label-secondary text-caption block truncate tabular-nums">
                          {`${formatCurrency(nation.currentTotalGdp)} · ${nation.economicTier}`}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 px-2 py-3">
                  <span className="text-footnote text-label-secondary">
                    {realm ? `No nations in ${realm.name} yet.` : "Select a realm to explore."}
                  </span>
                  {realm && (
                    <Link
                      href={`/r/${encodeURIComponent(realm.slug)}/nations`}
                      className="text-footnote text-tint-ink font-medium hover:underline"
                    >
                      Found a nation
                    </Link>
                  )}
                </div>
              )}
            </div>

            <dl className="border-separator divide-separator grid grid-cols-2 divide-x border-t py-2">
              <div className="flex min-w-0 items-center justify-center gap-1.5 px-2">
                <MapIcon aria-hidden className="text-blue size-3.5 shrink-0" />
                <dt className="text-label-secondary text-footnote">Atlas</dt>
                <dd className="text-label text-caption truncate font-medium">
                  <Link
                    href={realm ? `/maps?realm=${encodeURIComponent(realm.slug)}` : "/maps"}
                    className={cn("relative hover:underline", hitSlop)}
                  >
                    Interactive map
                  </Link>
                </dd>
              </div>
              <div className="flex min-w-0 items-center justify-center gap-1.5 px-2">
                <Globe aria-hidden className="text-indigo size-3.5 shrink-0" />
                <dt className="text-label-secondary text-footnote">Directory</dt>
                <dd className="text-tint-ink text-caption truncate font-medium tabular-nums">
                  <Link
                    href={
                      realm ? `/countries?realm=${encodeURIComponent(realm.slug)}` : "/countries"
                    }
                    className={cn("relative hover:underline", hitSlop)}
                  >
                    {realm ? `All ${realm.nationCount.toLocaleString()} nations` : "All nations"}
                  </Link>
                </dd>
              </div>
            </dl>
          </div>
        </FacetMaterial>
      </div>
    </Card>
  );
}
