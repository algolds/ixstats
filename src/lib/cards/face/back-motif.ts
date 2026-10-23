// src/lib/cards/face/back-motif.ts
import type { LoreCategory } from "@prisma/client";
import { IIWIKI_LOGO_URL, NATIONSTATES_LOGO_URL } from "~/lib/cards/realm-logos";
import { proxyCardArtwork } from "~/lib/cards/ns-image-proxy";
import { IIWIKI_REALM_ID, isIxnaySlug, NS_REALM_ID } from "~/lib/realms/realm-ids";
import { CATEGORY_ICONS } from "./category-icons";
import type { CardRealmBadge } from "./types";

/** The mark a card back repeats in its lattice: a vector path, an image, or a realm's initial. */
export type BackMotif =
  | { kind: "path"; viewBox: string; d: string }
  | { kind: "image"; href: string }
  | { kind: "initial"; letter: string };

/** Ixnay's mark, and the plain IxCards back's for a card not yet seen. */
const IX_LOGO = "/images/ix-logo.svg";

/**
 * The card's category when it has one; else its realm's mark: the Ix logo for Ixnay (and for no realm), the NationStates
 * and IIWiki logos, a realm's own emblem, or its initial.
 */
export function backMotif(
  category: LoreCategory | null,
  realm: Pick<CardRealmBadge, "slug" | "name" | "crestUrl"> | null
): BackMotif {
  if (category) {
    const icon = CATEGORY_ICONS[category];
    return { kind: "path", viewBox: icon.viewBox, d: icon.path };
  }
  if (!realm || isIxnaySlug(realm.slug)) return { kind: "image", href: IX_LOGO };
  // A system realm's slug is its id
  if (realm.slug === NS_REALM_ID) return { kind: "image", href: NATIONSTATES_LOGO_URL };
  if (realm.slug === IIWIKI_REALM_ID) return { kind: "image", href: IIWIKI_LOGO_URL };
  if (realm.crestUrl) return { kind: "image", href: proxyCardArtwork(realm.crestUrl) };
  return { kind: "initial", letter: realm.name.charAt(0).toUpperCase() };
}
