/**
 * Page metadata for `/@handle` (`src/app/id/[username]/layout.tsx`): what link unfurlers (Discord,
 * Slack) and search engines read. Pure: built from `getPassportCard` and `passportIndexable`.
 * Images are left to the route's `opengraph-image.tsx`, which Next attaches on its own.
 */
import type { Metadata } from "next";
import { withBasePath } from "~/lib/base-path";
import { lorewardsLabel, realmsAndNations } from "~/lib/passport/passport-labels";
import { NOINDEX, SITE_NAME, socialMetadata } from "~/lib/site-metadata";
import type { PassportCard } from "./identity.types";

const PASSPORT_TITLE = "IxStates Passport";
const GENERIC_DESCRIPTION = "Nations, realms and standing across IxStates.";

type PreviewCard = Extract<PassportCard, { preview: true }>;

/** "Burgundie · Eurth · #14 Lorewards · 47 pts · 1 realm · 1 nation", skipping hidden parts. */
function passportDescription(card: PreviewCard): string {
  const nation = card.primaryNation;
  const parts = [
    nation?.name.replace(/_/g, " "),
    nation?.realm.name,
    card.lorewards && lorewardsLabel(card.lorewards.score, card.lorewards.rank),
    realmsAndNations(card.realmCount, card.nationCount),
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : `${card.displayName} on IxStates.`;
}

/**
 * The passport page's metadata. A null card (unknown handle, or an external wiki or forum name)
 * adds only the indexing rule; `{ preview: false }` gives the generic IxStates Passport card with
 * no personal fields.
 */
export function passportMetadata(card: PassportCard | null, indexable: boolean): Metadata {
  const robots = indexable ? {} : NOINDEX;
  if (!card) return robots;
  if (!card.preview) {
    return {
      ...socialMetadata(PASSPORT_TITLE, GENERIC_DESCRIPTION, {
        type: "website",
        siteName: SITE_NAME,
        title: PASSPORT_TITLE,
        description: GENERIC_DESCRIPTION,
      }),
      ...robots,
    };
  }

  const url = withBasePath(`/@${card.handle}`);
  const title = `${card.displayName} (@${card.handle}) · ${PASSPORT_TITLE}`;
  const description = passportDescription(card);
  return {
    ...socialMetadata(title, description, {
      type: "profile",
      siteName: SITE_NAME,
      title,
      description,
      url,
      username: card.handle,
    }),
    alternates: { canonical: url },
    ...robots,
  };
}
