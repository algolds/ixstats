"use client";

import { useState, type ComponentType } from "react";
import { cn } from "~/lib/utils/cn";
import { proxyCardArtwork } from "~/lib/cards/ns-image-proxy";
import { IIWIKI_REALM_ID, NS_REALM_ID } from "~/lib/realms/realm-ids";
import type { CardRealmBadge } from "~/lib/cards/face/types";
import { NationStatesLogo } from "~/components/cards/display/NationStatesLogo";
import { IIWikiLogo } from "~/components/cards/display/IIWikiLogo";

const BOX = { sm: "size-4", md: "size-10", lg: "size-16" } as const;
const INITIAL_TEXT = { sm: "text-caption", md: "text-headline", lg: "text-title-1" } as const;

/** The system realms drawn by their logo. A system realm's slug is its id, so realms passed by slug alone match too. */
const SYSTEM_LOGO: ReadonlyMap<string, ComponentType<{ className?: string }>> = new Map([
  [NS_REALM_ID, NationStatesLogo],
  [IIWIKI_REALM_ID, IIWikiLogo],
]);

interface RealmCrestProps {
  realm: CardRealmBadge;
  size?: keyof typeof BOX;
  /** Dimmed and grey, for a card the viewer has not collected. */
  muted?: boolean;
  className?: string;
}

/**
 * A realm's crest: the NationStates or IIWiki logo for those system realms, else the realm's emblem or its initial.
 * Hidden from assistive tech in every form, because the realm's name always sits beside it or in the face's name.
 */
export function RealmCrest({ realm, size = "sm", muted = false, className }: RealmCrestProps) {
  // The emblem URL that failed, so a broken emblem shows the initial and a new emblem is tried.
  const [failedCrest, setFailedCrest] = useState<string | null>(null);
  const box = (...shape: string[]) =>
    cn(...shape, BOX[size], "shrink-0", muted && "opacity-60 grayscale", className);

  const Logo = SYSTEM_LOGO.get(realm.slug);
  if (Logo) {
    return (
      <span aria-hidden="true" className={box("inline-block")}>
        <Logo className="size-full object-contain" />
      </span>
    );
  }
  const crest = realm.crestUrl;
  if (crest && crest !== failedCrest) {
    return (
      <img
        src={proxyCardArtwork(crest)}
        alt=""
        aria-hidden="true"
        loading="lazy"
        onError={() => setFailedCrest(crest)}
        className={box("rounded-full object-cover")}
      />
    );
  }
  // card-face-initial: the disc darkens in the light theme, so the white letter reads at 4.5:1 (card-art.css).
  return (
    <span
      aria-hidden="true"
      className={box(
        "card-face-initial grid place-items-center rounded-full font-semibold text-white",
        INITIAL_TEXT[size]
      )}
    >
      {realm.name.charAt(0).toUpperCase()}
    </span>
  );
}
