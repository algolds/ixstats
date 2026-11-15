"use client";

import React from "react";
import { Page, BookStack, Map, ProfileCircle, GraphUp, Crown } from "iconoir-react";
import Link from "next/link";
import { api } from "~/trpc/react";
import { cn, formatCompactNumber } from "~/lib/utils";
import { formatCompactCurrency } from "~/lib/utils/format-utils";
import { titleToWikiOSRoute } from "~/lib/wiki-os/transformers/url-compat";
import { nationHref } from "~/lib/exchange/routes";
import { handleProfileHref } from "~/lib/thinkpages-forum/links";
import { Button, focusRing } from "~/components/ui/button";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { HealthRing } from "~/components/ui/health-ring";
import {
  heroRings,
  vitalityStanding,
  type HeroModal,
} from "~/components/shared/country-hero/HeroSnapshotPanels";
import { SheetDescription, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { FacetMaterial } from "~/components/ui/facet";
import { badgeVariants } from "~/components/ui/badge";
import type { APP_IDS } from "~/lib/design/tokens";

export type IconType = React.ComponentType<{ className?: string }>;
type AppId = (typeof APP_IDS)[number];

/**
 * Each action's colour says what kind of act it is (social blue and teal, trade green, hostile red,
 * utilities grey), on a tile so the label stays neutral and readable in both themes.
 */
const TONES = {
  blue: "bg-blue/15 text-blue",
  teal: "bg-teal/15 text-teal",
  cyan: "bg-cyan/15 text-cyan",
  green: "bg-green/15 text-green",
  yellow: "bg-yellow/15 text-yellow",
  orange: "bg-orange/15 text-orange",
  red: "bg-red/15 text-red",
  gray: "bg-fill-3 text-label-secondary",
} as const;

export type Tone = keyof typeof TONES;

/** One "Open in" destination: the app it opens wears that app's tint (`data-app`); `null` is neutral. */
export interface Destination {
  label: string;
  href: string;
  icon: IconType;
  app: AppId | null;
}

export interface CountryFacts {
  slug: string | null;
  ownerHandle: string | null;
}

/** Everywhere else the nation lives in IxStates (its realm is the header's pill). Passport only when it has a leader. */
export function destinationsFor(
  id: string,
  name: string,
  facts: CountryFacts | null
): Destination[] {
  const list: Array<Destination | null> = [
    { label: "Profile", href: `/countries/${facts?.slug ?? id}`, icon: Page, app: "mycountry" },
    { label: "Wiki", href: titleToWikiOSRoute(name), icon: BookStack, app: "wiki" },
    {
      label: "Map",
      href: `/maps?country=${encodeURIComponent(id)}&name=${encodeURIComponent(name)}`,
      icon: Map,
      app: "maps",
    },
    facts?.ownerHandle
      ? {
          label: "Passport",
          href: handleProfileHref(facts.ownerHandle),
          icon: ProfileCircle,
          app: null,
        }
      : null,
    { label: "Exchange", href: nationHref(id), icon: GraphUp, app: "exchange" },
  ];
  return list.filter((d): d is Destination => d !== null);
}

export function ToneTile({
  icon: Icon,
  tone,
  size = "sm",
}: {
  icon: IconType;
  tone: Tone;
  size?: "sm" | "lg";
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center",
        size === "lg" ? "size-11 rounded-full" : "rounded-control-sm size-7",
        TONES[tone]
      )}
    >
      <Icon className={size === "lg" ? "size-5" : "size-4"} />
    </span>
  );
}

/**
 * The poster: the flag fills the top of the sheet and fades into it behind the name, the realm pill,
 * the quick actions and the vitality strip, like a contact poster.
 */
export function PosterHeader({
  countryId,
  name,
  isOwnCountry,
  enabled,
  onNavigate,
  size = "sheet",
  badges,
  corner,
  children,
}: {
  countryId: string;
  name: string;
  isOwnCountry: boolean;
  enabled: boolean;
  /** A link in the header closes the sheet as it navigates. */
  onNavigate: () => void;
  /** `sheet` bleeds to a Sheet's edges and titles the dialog; `halo` is a rounded panel inside Halo's island. */
  size?: "sheet" | "halo";
  /** Extra badges after the realm and leader (Halo shows the membership tier). */
  badges?: React.ReactNode;
  /** Controls pinned to the poster's top corner (Halo's Edit and Share; the sheet keeps its own corner). */
  corner?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { data: country } = api.countries.getByIdBasic.useQuery({ id: countryId }, { enabled });
  const leader = isOwnCountry
    ? "Your nation"
    : country?.ownerHandle
      ? `@${country.ownerHandle}`
      : null;

  const inSheet = size === "sheet";
  const meta = (
    <div className="text-footnote text-label-secondary flex min-w-0 flex-wrap items-center gap-2">
      {/* A nation's realm is part of its identity, so it wears the ink like the passport's, not the Realms tint. */}
      {country?.realm && (
        <Link
          href={`/r/${country.realm.slug}`}
          onClick={onNavigate}
          className={cn(
            badgeVariants({ variant: "secondary" }),
            "duration-fast transition-opacity active:opacity-70",
            focusRing
          )}
        >
          <Crown aria-hidden className="size-3" />
          {country.realm.name}
        </Link>
      )}
      {leader && <span className="truncate">{leader}</span>}
      {badges}
    </div>
  );

  return (
    // In a sheet it bleeds to the edges (the side sheet pads its top, the bottom sheet's grabber sits above). Clip, not
    // hidden: the blurred flag overhangs, and a hidden box still scrolls when focus brings a button into view.
    <div
      className={cn(
        "relative shrink-0 space-y-4 overflow-clip",
        inSheet ? "-mx-6 px-6 pt-36 pb-4 md:-mt-6" : "rounded-row px-4 pt-20 pb-3"
      )}
    >
      {/* A blurred copy carries the flag's colours down behind the actions and the strip. */}
      <PosterFlag
        name={name}
        flagUrl={country?.flagUrl}
        className="scale-125 [mask-image:linear-gradient(to_bottom,black_55%,transparent)] opacity-60 blur-2xl"
      />
      {/* The flag itself, sharp at the top, gone before the name. */}
      <PosterFlag
        name={name}
        flagUrl={country?.flagUrl}
        className="[mask-image:linear-gradient(to_bottom,black_20%,transparent_55%)]"
      />
      <div
        aria-hidden
        className="via-surface-elevated/60 absolute inset-0 bg-linear-to-b from-transparent from-20% via-50% to-transparent"
      />
      {corner && (
        <div className="z-raised absolute top-3 right-3 flex items-center gap-1.5">{corner}</div>
      )}
      {inSheet ? (
        <SheetHeader data-content="entity" className="relative gap-1.5 text-left">
          <SheetTitle className="text-title-1 truncate font-semibold tracking-tight">
            {name}
          </SheetTitle>
          <SheetDescription asChild>{meta}</SheetDescription>
        </SheetHeader>
      ) : (
        <div data-content="entity" className="relative flex flex-col gap-1.5 text-left">
          <h2 className="text-title-2 text-label truncate font-semibold tracking-tight">{name}</h2>
          {meta}
        </div>
      )}
      <div className="relative space-y-4">{children}</div>
    </div>
  );
}

/** One flag layer of the poster: decorative, full-bleed, cropped to fill. */
function PosterFlag({
  name,
  flagUrl,
  className,
}: {
  name: string;
  flagUrl: string | null | undefined;
  className: string;
}) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0", className)}>
      <UnifiedCountryFlag
        showTooltip={false}
        countryName={name}
        flagUrl={flagUrl}
        fitContainer
        objectFit="cover"
        rounded={false}
        className="size-full"
      />
    </div>
  );
}

/** Vitality, population and GDP at a glance, as on the MyCountry hero; each opens its detail sheet. */
export function VitalityStrip({
  countryId,
  enabled,
  onOpen,
}: {
  countryId: string;
  enabled: boolean;
  onOpen: (modal: HeroModal) => void;
}) {
  const { data: country } = api.countries.getByIdBasic.useQuery({ id: countryId }, { enabled });
  const { data: rings } = api.countries.getActivityRingsData.useQuery(
    { countryId },
    { enabled, staleTime: 5 * 60_000 }
  );
  const standing = rings ? vitalityStanding(heroRings(rings)) : null;

  return (
    // The frosted Lens over the flag, as on the dashboard and profile hero panels: one surface with the poster.
    <FacetMaterial
      layer="lens"
      data-content="data"
      className="facet-lens-frosted rounded-row grid grid-cols-3 gap-1 p-1.5"
    >
      <StripFigure label="Vitality" title="Vitality breakdown" onClick={() => onOpen("vitality")}>
        {standing ? (
          <span className={cn("flex items-center gap-1.5", standing.color)}>
            <HealthRing value={standing.score} size={14} color="currentColor" label="Vitality" />
            <span className="truncate">{standing.label}</span>
          </span>
        ) : (
          <span className="text-label-secondary">N/A</span>
        )}
      </StripFigure>
      <StripFigure
        label="Population"
        title="Population breakdown"
        onClick={() => onOpen("population")}
      >
        <span className="text-label tabular-nums">
          {formatCompactNumber(country?.currentPopulation)}
        </span>
      </StripFigure>
      <StripFigure label="GDP" title="GDP breakdown" onClick={() => onOpen("gdp")}>
        <span className="text-success tabular-nums">
          {formatCompactCurrency(country?.currentTotalGdp)}
        </span>
      </StripFigure>
    </FacetMaterial>
  );
}

function StripFigure({
  label,
  title,
  onClick,
  children,
}: {
  label: string;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "hover:bg-fill-4 rounded-control duration-fast min-w-0 cursor-pointer space-y-1 p-1.5 text-left transition-colors",
        focusRing
      )}
    >
      <span className="text-caption text-label-secondary block">{label}</span>
      <span className="text-footnote block">{children}</span>
    </button>
  );
}

/** A round quick action under the header, like a contact card's. */
export function QuickAction({
  icon,
  label,
  tone,
  onClick,
  disabled,
  pressed,
}: {
  icon: IconType;
  label: string;
  tone: Tone;
  onClick: () => void;
  disabled?: boolean;
  /** For a toggle (Summit opens its form in place). */
  pressed?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      className="aria-pressed:bg-fill-4 h-auto flex-col gap-1.5 px-1 py-2"
    >
      <ToneTile icon={icon} tone={tone} size="lg" />
      <span className="text-caption text-label">{label}</span>
    </Button>
  );
}

/** "Open in": one tile per app the nation appears in, each in its app's tint. */
export function OpenIn({
  destinations,
  onNavigate,
}: {
  destinations: Destination[];
  onNavigate: () => void;
}) {
  return (
    <section aria-labelledby="country-open-in" className="space-y-2">
      <h3 id="country-open-in" className="text-subhead text-label-secondary px-1">
        Open in
      </h3>
      <ul className={cn("grid gap-1", destinations.length > 4 ? "grid-cols-5" : "grid-cols-4")}>
        {destinations.map((d) => (
          <li key={d.label}>
            <Link
              href={d.href}
              onClick={onNavigate}
              className={cn(
                "hover:bg-fill-4 rounded-control duration-fast flex flex-col items-center gap-1.5 px-1 py-2 transition-colors",
                focusRing
              )}
            >
              <span
                aria-hidden
                data-app={d.app ?? undefined}
                className={cn(
                  "rounded-control grid size-10 place-items-center",
                  d.app ? "bg-tint-fill text-tint-ink" : "bg-fill-3 text-label"
                )}
              >
                <d.icon className="size-5" />
              </span>
              <span className="text-caption text-label">{d.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
