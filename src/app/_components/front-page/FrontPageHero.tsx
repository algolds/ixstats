"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Coins,
  Compass,
  Crown,
  Globe,
  Group as Users,
  Map as MapIcon,
  NavArrowRight,
  TriangleFlag,
} from "iconoir-react";
import {
  CoordinatesMapEmbed,
  type EmbedPoliticalFeature,
} from "~/components/maps/widgets/CoordinatesMapEmbed";
import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from "motion/react";
import { useFacetReducedMotion } from "~/components/providers/FacetMotionConfig";
import { springSmooth } from "~/lib/design/motion";
import { RealmAvatar } from "~/components/realms/RealmAvatar";
import { FacetMaterial } from "~/components/ui/facet";
import { Badge } from "~/components/ui/badge";
import { Button, hitSlop } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { SignInButton } from "~/context/auth-context";
import { useFlag } from "~/hooks/useUnifiedFlags";
import { assetUrl, withBasePath } from "~/lib/base-path";
import { formatCurrency } from "~/lib/utils";
import { cn } from "~/lib/utils/cn";
import { api, type RouterOutputs } from "~/trpc/react";

type FrontPageData = RouterOutputs["frontPage"]["get"];
export type FeaturedRealmItem = NonNullable<FrontPageData["featured"]>;

/** Telemetry cells modelled on HeroSnapshotPanels: hover wash, icon tint, and tactile press. */
const SNAPSHOT_CELL =
  "group facet-press facet-press-sm hover:bg-fill-4 rounded-control focus-visible:outline-tint flex min-w-0 cursor-pointer items-center gap-2 px-2.5 py-1.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2";

const ICON_TINT =
  "transition-colors duration-fast group-hover:text-label group-focus-visible:text-label";

function useIdleWorldZoom(box: React.RefObject<HTMLDivElement | null>): number | null {
  const [zoom, setZoom] = useState<number | null>(null);
  useEffect(() => {
    const fit = () => {
      const w = Math.max(box.current?.clientWidth ?? 512, 256);
      const h = Math.max(box.current?.clientHeight ?? 320, 200);
      setZoom(Math.log2(Math.max(w, h) / 512));
    };
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(fit, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(fit, 200);
    return () => clearTimeout(id);
  }, [box]);
  return zoom;
}

/**
 * The monogram's layers, each a tile in its app's tint: the emblem and the W in the Wiki navy. `depth`
 * is how far a layer drifts from the pointer, in px at the hero's edge: the emblems sit deeper than the
 * app marks, so the pattern separates into two planes as the mouse moves.
 */
const MONOGRAM_LAYERS = (
  [
    ["wiki", 8],
    ["mycountry", 16],
    ["maps", 16],
    ["realms", 16],
  ] as const
).map(([app, depth]) => ({
  app,
  depth,
  style: {
    "--monogram": `url("${withBasePath(`/images/ix-monogram-${app}.svg`)}")`,
  } as CSSProperties,
}));

/** The emblem, painted in the Wiki tint through a mask so it holds contrast in both themes. */
const EMBLEM_STYLE = {
  maskImage: `url("${withBasePath("/images/ix-logo.svg?v=2")}")`,
  maskSize: "contain",
  maskRepeat: "no-repeat",
} satisfies CSSProperties;

function MonogramLayer({
  app,
  depth,
  style,
  px,
  py,
}: (typeof MONOGRAM_LAYERS)[number] & { px: MotionValue<number>; py: MotionValue<number> }) {
  const x = useTransform(px, (v) => v * -depth);
  const y = useTransform(py, (v) => v * -depth);
  return (
    <motion.div
      data-app={app}
      className="facet-monogram absolute -inset-6"
      style={{ ...style, x, y }}
    />
  );
}

const WORDMARK_STYLE = {
  maskImage: `url("${withBasePath("/images/ixstates-wordmark.svg")}")`,
  maskSize: "contain",
  maskRepeat: "no-repeat",
} satisfies CSSProperties;

function PlatformTopBar({ facts }: { facts: FrontPageData["facts"] | undefined }) {
  const reduceMotion = useFacetReducedMotion();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const px = useSpring(pointerX, springSmooth);
  const py = useSpring(pointerY, springSmooth);

  // The pointer's place in the hero, -1 to 1 on each axis; mouse only (touch has no hover to follow).
  const followPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || reduceMotion) return;
    const box = event.currentTarget.getBoundingClientRect();
    pointerX.set(((event.clientX - box.left) / box.width) * 2 - 1);
    pointerY.set(((event.clientY - box.top) / box.height) * 2 - 1);
  };
  const recentre = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

  const platformStats = [
    {
      href: "/realms",
      icon: Globe,
      tone: "text-blue",
      label: "realms",
      value: facts ? facts.realms.toLocaleString() : "–",
    },
    {
      href: "/countries",
      icon: Crown,
      tone: "text-yellow",
      label: "nations",
      value: facts ? facts.nations.toLocaleString() : "–",
    },
    {
      href: "/thinkpages",
      icon: Users,
      tone: "text-teal",
      label: "players",
      value: facts ? facts.players.toLocaleString() : "–",
    },
  ] as const;

  return (
    <div
      className="border-separator relative overflow-hidden border-b px-4 py-8 text-center md:py-10"
      onPointerMove={followPointer}
      onPointerLeave={recentre}
    >
      <div
        aria-hidden
        className="scroll-parallax pointer-events-none absolute inset-x-0 -top-24 bottom-0 print:hidden"
      >
        {MONOGRAM_LAYERS.map((layer) => (
          <MonogramLayer key={layer.app} {...layer} px={px} py={py} />
        ))}
      </div>
      <FacetMaterial
        layer="lens"
        aria-hidden
        className="scroll-recede pointer-events-none absolute inset-x-3 inset-y-4 mx-auto max-w-[640px] rounded-[32px] md:inset-y-5 print:hidden"
      />
      <div className="scroll-recede relative flex flex-col items-center">
        <span aria-hidden data-app="wiki" className="bg-tint block size-16" style={EMBLEM_STYLE} />
        {/* The wordmark asset (Schibsted Grotesk 800, hand-spaced, outlined) painted in the label ink
            through a mask, so it follows the theme. Sized in em off text-display: 74 of its 100-unit
            em tall, so it scales with the user's text size like the title it replaces. */}
        <h1 className="text-display mt-4 leading-none">
          <span className="sr-only">IxStates</span>
          <span
            aria-hidden
            className="bg-label block aspect-[417/74] h-[0.74em]"
            style={WORDMARK_STYLE}
          />
        </h1>
        <p className="text-title-3 text-label-secondary mt-2 font-normal">
          The operating system for worldbuilding
        </p>
        <div
          aria-label="Platform totals"
          className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1"
        >
          {platformStats.map(({ href, icon: Icon, tone, label, value }) => (
            <Link
              key={label}
              href={href}
              className={cn(
                "text-footnote text-label-secondary hover:text-label focus-visible:outline-tint rounded-control-sm duration-fast relative inline-flex items-center gap-1.5 tabular-nums transition-colors focus-visible:outline-2",
                hitSlop
              )}
            >
              <Icon aria-hidden className={cn(tone, "size-3.5 shrink-0")} />
              <span className="text-label font-medium">{value}</span>
              <span>{label}</span>
            </Link>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {/* ponytail: Clerk's sign-in-or-up flow; the email decides which, so one button covers both */}
          <SignInButton mode="modal" withSignUp>
            <Button size="lg" className="rounded-full">
              <span>Sign in</span>
              <NavArrowRight aria-hidden />
            </Button>
          </SignInButton>
          <Button variant="secondary" size="lg" className="rounded-full" asChild>
            <Link href="/realms">Explore realms</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function HeroMapStage({
  realm,
  nations,
  className,
}: {
  realm: FeaturedRealmItem | undefined;
  nations: FrontPageData["nations"];
  className?: string;
}) {
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const zoom = useIdleWorldZoom(box);
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

  const { flagUrl: fallbackFlagUrl } = useFlag(
    hoveredCountry && !matchedCountry?.flagUrl ? hoveredCountry.displayName : undefined,
    realm?.slug
  );
  const hoveredFlagUrl = matchedCountry?.flagUrl ?? fallbackFlagUrl;

  const handleCountryHover = useCallback((next: EmbedPoliticalFeature | null) => {
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
  }, []);

  const handleCountryClick = useCallback(
    (country: EmbedPoliticalFeature) => {
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
    },
    [nations, realm?.slug, realmCountries, router]
  );

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
    <Card className="relative overflow-hidden">
      <PlatformTopBar facts={facts} />

      <div className="relative grid gap-3 p-3 md:grid-cols-5">
        <HeroMapStage realm={realm} nations={nations} className="md:col-span-3" />

        <FacetMaterial
          layer="lens"
          className="rounded-row flex h-full flex-col gap-2.5 overflow-hidden p-3 md:col-span-2"
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
