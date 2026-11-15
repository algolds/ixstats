"use client";

import { Badge } from "~/components/ui/badge";
import { countryTransitionName, SharedElement } from "~/components/ui/view-transition";
import { CountryOwnerRibbonRack } from "~/components/achievements/FloatingRibbonRack";
import { CountryIdentityStrip } from "~/components/country-profile/CountryIdentityStrip";
import { FlagTile } from "~/components/country-profile/HeroMedia";
import { NationDateLine } from "~/components/realms/NationDateLine";
import { useCountryData } from "~/components/mycountry/shared/primitives";
import { assetUrl } from "~/lib/base-path";
import { stripHtml } from "~/lib/utils/sanitize-html";

function str(value: string | null | undefined): string | null {
  const plain = value ? stripHtml(value).trim() : "";
  return plain || null;
}

/** "CONSTITUTIONAL_MONARCHY" → "Constitutional monarchy"; ordinary text passes through. */
export function humanizeEnum(value: string): string {
  if (!/^[A-Z0-9_]+$/.test(value)) return value;
  const words = value.toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * CommandIdentity — the command face's identity, laid out as the profile's: flag tile, region line,
 * the page's one `<h1>` with the owner's ribbons, the motto, system of government and capital as
 * chips, the realm and IxnayID strip, and the nation's date. `titleRef` hands the `<h1>` to the
 * sticky command bar, which collapses once it scrolls away.
 */
export function CommandIdentity({
  titleRef,
}: {
  titleRef?: (el: HTMLHeadingElement | null) => void;
}) {
  const { country } = useCountryData();
  const rawName = country?.name;
  const name = rawName ? rawName.replace(/_/g, " ") : "MyCountry";
  const identity = country?.nationalIdentity;
  const motto = str(identity?.motto);
  const system = str(country?.governmentType);
  const capital = str(identity?.capitalCity);
  const continent = country?.continent;
  const regionName = country?.region;
  const region = [continent, regionName].filter(Boolean).join(" · ") || null;
  const realm = country?.realm
    ? {
        name: country.realm.name,
        slug: country.realm.slug,
        logoUrl: country.realm.emblemUrl ?? country.realm.thumbnail,
      }
    : null;
  const slug = country?.slug;
  const flagUrl = country?.flagUrl;
  const flagFallback = country?.flag;
  const flagSrc = assetUrl(flagUrl || flagFallback) ?? null;
  const owner = country?.owner;
  const ownerRole = owner?.role;
  const sovereign = owner
    ? {
        username: str(owner.handle) ?? str(owner.forumUsername),
        roleName: str(ownerRole?.displayName) ?? str(ownerRole?.name),
        avatarUrl: owner.avatarUrl,
      }
    : null;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <SharedElement name={countryTransitionName("flag", slug)}>
          <FlagTile src={flagSrc} name={name} />
        </SharedElement>
        <div className="min-w-0">
          {region && <p className="text-footnote text-label-secondary">{region}</p>}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <SharedElement name={countryTransitionName("title", slug)}>
              <h1 ref={titleRef} className="text-large-title text-label text-balance">
                {name}
              </h1>
            </SharedElement>
            {slug && <CountryOwnerRibbonRack countrySlug={slug} />}
          </div>
          {motto && (
            <p className="text-callout text-label-secondary text-pretty">
              <span className="sr-only">Motto: </span>&ldquo;{motto}&rdquo;
            </p>
          )}
        </div>
      </div>
      {(system || capital) && (
        <div className="flex flex-wrap items-center gap-2">
          {system && <Badge variant="default">{humanizeEnum(system)}</Badge>}
          {capital && <Badge variant="default">Capital {capital}</Badge>}
        </div>
      )}
      <CountryIdentityStrip realm={realm} sovereign={sovereign} />
      <NationDateLine className="text-footnote text-label-secondary" />
    </div>
  );
}
