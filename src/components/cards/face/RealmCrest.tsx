"use client";

import { cn } from "~/lib/utils/cn";
import { proxyCardArtwork } from "~/lib/cards/ns-image-proxy";
import { IIWIKI_REALM_ID, NS_REALM_ID } from "~/lib/realms/realm-ids";
import type { CardRealmBadge } from "~/lib/cards/face/types";
import { NationStatesLogo } from "~/components/cards/display/NationStatesLogo";
import { IIWikiLogo } from "~/components/cards/display/IIWikiLogo";

const BOX = { sm: "size-4", md: "size-10", lg: "size-16" } as const;
const INITIAL_TEXT = { sm: "text-caption", md: "text-headline", lg: "text-title-1" } as const;

interface RealmCrestProps {
  realm: CardRealmBadge;
  size?: keyof typeof BOX;
  /** Dimmed and grey, for a card the viewer has not collected. */
  muted?: boolean;
  className?: string;
}

/**
 * A realm's crest: the NationStates or IIWiki logo for those system realms, else the realm's emblem or its initial.
 * A system realm's slug is its id, so the slug check also holds for realms passed by slug alone.
 */
export function RealmCrest({ realm, size = "sm", muted = false, className }: RealmCrestProps) {
  const box = cn(BOX[size], "shrink-0", muted && "opacity-60 grayscale", className);
  if (realm.slug === NS_REALM_ID) {
    return <NationStatesLogo className={cn(box, "object-contain")} />;
  }
  if (realm.slug === IIWIKI_REALM_ID) {
    return <IIWikiLogo className={cn(box, "object-contain")} />;
  }
  if (realm.crestUrl) {
    return (
      <img
        src={proxyCardArtwork(realm.crestUrl)}
        alt=""
        loading="lazy"
        className={cn(box, "rounded-full object-cover")}
      />
    );
  }
  return (
    <span
      className={cn(
        box,
        INITIAL_TEXT[size],
        "grid place-items-center rounded-full bg-black/40 font-semibold text-white"
      )}
    >
      {realm.name.charAt(0).toUpperCase()}
    </span>
  );
}
