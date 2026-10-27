"use client";

import { CountryOwnerRibbonRack } from "~/components/achievements/FloatingRibbonRack";
import { Badge } from "~/components/ui/badge";
import { CountryHeroCard } from "~/components/shared/country-hero/CountryHeroCard";
import type { HeroRing } from "~/components/shared/country-hero/HeroSnapshotPanels";
import { stripHtml } from "~/lib/utils/sanitize-html";
import { CountryIdentityStrip, type CountryIdentityStripProps } from "./CountryIdentityStrip";
import { CoverMedia, FlagTile, type HeroCover } from "./HeroMedia";

interface ProfileHeroProps extends CountryIdentityStripProps {
  countryId: string;
  /** The URL slug; loads the owner's ribbon rack beside the name. */
  slug: string;
  name: string;
  officialName?: string | null;
  flagUrl: string | null;
  /** Continent · region, above the name. */
  region?: string | null;
  governmentType?: string | null;
  capital?: string | null;
  stats: { population: number; currentTotalGdp: number; gdpPerCapita: number };
  cover: HeroCover | null;
  /** The full-width row under the card (the overview's standing row); takes the rings. */
  footer?: (ctx: { rings: HeroRing[]; openVitality: () => void }) => React.ReactNode;
  /** The face's one button (Country actions, or the owner's Manage). */
  action?: React.ReactNode;
  /** The hero map's expand control: opens the Map tab. */
  onExpandMap?: () => void;
}

/** Wiki infobox values can carry raw HTML (<div>, <br>…); these fields are plain text. */
const plain = (value: string | null | undefined) => (value ? stripHtml(value) : null);

function ProfileIdentity({
  slug,
  name,
  officialName,
  flagUrl,
  region,
  governmentType,
  capital,
  realm,
  sovereign,
  claim,
}: Omit<ProfileHeroProps, "countryId" | "stats" | "cover" | "footer" | "action" | "onExpandMap">) {
  const official = plain(officialName);
  const system = plain(governmentType);
  const seat = plain(capital);
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <FlagTile src={flagUrl} name={name} />
        <div className="min-w-0">
          {region && <p className="text-footnote text-label-secondary">{region}</p>}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="text-large-title text-label text-balance">{name}</h1>
            <CountryOwnerRibbonRack countrySlug={slug} />
          </div>
          {official && official !== name && (
            <p className="text-callout text-label-secondary">{official}</p>
          )}
        </div>
      </div>
      {(system || seat) && (
        <div className="flex flex-wrap items-center gap-2">
          {system && <Badge variant="default">{system}</Badge>}
          {seat && <Badge variant="default">Capital {seat}</Badge>}
        </div>
      )}
      <CountryIdentityStrip realm={realm} sovereign={sovereign} claim={claim} />
    </div>
  );
}

/**
 * ProfileHero — the country document's face on the shared `CountryHeroCard` (frameless: the
 * document is the card): the live map (or the owner's cover) in the media slot, and the flag,
 * name, ribbons, official name, region, system of government, capital and the realm and
 * IxnayID strip in the panel above the figures.
 */
export function ProfileHero({
  countryId,
  stats,
  cover,
  footer,
  action,
  onExpandMap,
  ...identity
}: ProfileHeroProps) {
  return (
    <CountryHeroCard
      frameless
      countryId={countryId}
      countryName={identity.name}
      flagUrl={identity.flagUrl}
      stats={stats}
      media={<CoverMedia cover={cover} countryId={countryId} onExpand={onExpandMap} />}
      identity={<ProfileIdentity {...identity} />}
      action={action}
      footer={footer}
    />
  );
}
