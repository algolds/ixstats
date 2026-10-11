"use client";

import React, { useState } from "react";
import Link from "next/link";
import { KeyCommand as Command, User } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { useHasMycountryPremium } from "~/hooks/useHasMycountryPremium";
import { useCountryData } from "~/components/mycountry/shared/primitives";
import type { CommandNavMode } from "../command-nav-mode";
import { PageHeader, BACKDROP_PLATE } from "~/components/shell/PageHeader";
import { assetUrl } from "~/lib/base-path";
import { CountryIdentityStrip } from "~/components/country-profile/CountryIdentityStrip";
import { FlagTile } from "~/components/country-profile/CountryHero";
import { CountryOwnerRibbonRack } from "~/components/achievements/FloatingRibbonRack";
import { stripHtml } from "~/lib/utils/sanitize-html";
import { EditMorphButton } from "./EditMorphButton";
import { FlagBanner } from "./FlagBanner";

/** Ghost actions over the flag get the title plate's strength, with an opaque hover and press. */
const ACTION_PLATE = cn(
  BACKDROP_PLATE,
  "hover:bg-surface-secondary active:bg-surface-secondary rounded-full"
);

interface UnifiedGlassCommandBarProps {
  mode: CommandNavMode;
  onChangeMode: (mode: CommandNavMode) => void;
  onDeclare?: () => void;
}

function str(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

/** "CONSTITUTIONAL_MONARCHY" → "Constitutional monarchy"; ordinary text passes through. */
function humanizeEnum(value: string): string {
  if (!/^[A-Z0-9_]+$/.test(value)) return value;
  const words = value.toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The MyCountry page header: the country's name and identity over its flag as cover art, and a
 * toolbar (Profile, Edit, and the one Declare Directive button). Identity follows the country
 * profile hero: the flag tile, realm and IxnayID strip, ribbons and motto. The banner is cover art
 * (no small flag beside the title) and collapses with the header. Section switching is the global
 * source list.
 */
export function UnifiedGlassCommandBar({
  mode,
  onChangeMode,
  onDeclare,
}: UnifiedGlassCommandBarProps) {
  const { country } = useCountryData();
  // The map editor is a MyCountry Premium tool (beta testers included), so others never see the entry.
  const canUseMapEditor = useHasMycountryPremium("map-editor");

  const profileHref = country?.slug ? `/countries/${country.slug}` : "/countries";

  const isExecutiveMode = mode === "executive";

  const name = country?.name ?? "MyCountry";
  const motto = str(country?.nationalIdentity?.motto);
  const governmentType = str(country?.governmentType);
  const realm = country?.realm
    ? {
        name: country.realm.name,
        slug: country.realm.slug,
        logoUrl: country.realm.emblemUrl ?? country.realm.thumbnail,
      }
    : null;
  const owner = country?.owner;
  const sovereign = owner
    ? {
        username: str(owner.forumUsername) ?? str(owner.wikiUsername),
        roleName: str(owner.role?.displayName) ?? str(owner.role?.name),
        avatarUrl: owner.avatarUrl,
        role: owner.clerkRole ?? str(owner.role?.name),
      }
    : null;
  const flagUrl = assetUrl(country?.flagUrl || country?.flag);
  // The flag whose image failed to load; a different flag is tried afresh. The plates behind the
  // title and the action pills exist only to sit over the art, so they follow whether it shows.
  const [failedFlag, setFailedFlag] = useState<string | null>(null);
  const bannerShowing = Boolean(flagUrl) && failedFlag !== flagUrl;
  // Pills only over the visible art: not in the compact bar (its own chrome is the backdrop there).
  const plate = (collapsed: boolean) => (bannerShowing && !collapsed ? ACTION_PLATE : undefined);

  return (
    <PageHeader
      title={name}
      className="group/hero"
      leading={<FlagTile src={flagUrl ?? null} name={name} />}
      // Always present, so the header's padding never jumps when the flag arrives late or fails.
      backdrop={
        <FlagBanner src={bannerShowing ? flagUrl : null} onError={() => setFailedFlag(flagUrl)} />
      }
      backdropVisible={bannerShowing}
      subtitle={
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <CountryIdentityStrip realm={realm} sovereign={sovereign} />
            {country?.slug && <CountryOwnerRibbonRack countrySlug={country.slug} />}
          </div>
          {motto && (
            <p className="text-pretty">
              <span className="sr-only">Motto: </span>&ldquo;{stripHtml(motto)}&rdquo;
            </p>
          )}
          {governmentType && <p className="text-footnote">{humanizeEnum(governmentType)}</p>}
        </div>
      }
      actions={({ collapsed }) => (
        <>
          <Button asChild variant="ghost" className={cn("text-label-secondary", plate(collapsed))}>
            <Link href={profileHref} aria-label="Open public profile" title="Open public profile">
              <User aria-hidden="true" />
              <span className="hidden md:inline">Profile</span>
            </Link>
          </Button>
          <EditMorphButton plate={plate(collapsed)} withMapEditor={canUseMapEditor} />
          <Button
            type="button"
            aria-pressed={isExecutiveMode}
            onClick={() => {
              if (onDeclare) onDeclare();
              else onChangeMode("executive");
            }}
            className={cn(
              isExecutiveMode && "ring-offset-surface ring-tint/40 ring-2 ring-offset-2"
            )}
          >
            <Command aria-hidden="true" />
            <span>Declare Directive</span>
          </Button>
        </>
      )}
    />
  );
}
