/**
 * What the link-unfurl images print, as plain data (no JSX, no I/O): the passport card for
 * `/@handle` and the realm passport, and the realm card for `/r/{realm}`. The renderers in
 * `src/lib/og/*Image.tsx` lay these out; the routes fetch the data and the images.
 *
 * The passport card shows only what the passport's front face shows an anonymous visitor: name,
 * handle, portrait, the primary nation line and the three facts. Never the signature or the bio.
 */
import { guillochePaths } from "~/lib/passport/guilloche";
import {
  PASSPORT_GENERIC_DESCRIPTION,
  PASSPORT_TITLE,
  REALM_ROLE_LABEL,
  lorewardsLabel,
  realmsAndNations,
  sinceLabel,
} from "~/lib/passport/passport-labels";
import { realmCountsLine } from "~/lib/realms/realm-region";

/**
 * The slice of `getPassportCard` (src/server/modules/identity) the card reads. Null for an unknown
 * handle; `{ preview: false }` when the holder turned link previews off.
 */
export type PassportOgCard =
  | null
  | { preview: false }
  | {
      preview: true;
      handle: string;
      displayName: string;
      /** Raw stored avatar; the route resolves and fetches it. */
      avatarUrl: string | null;
      primaryNation: {
        name: string;
        flagUrl: string | null;
        realm: { name: string };
        role: keyof typeof REALM_ROLE_LABEL;
      } | null;
      lorewards: { score: number; rank: number | null } | null;
      realmCount: number;
      nationCount: number;
      joinedAt: Date | null;
    };

/** One of the three facts. The Lorewards rank is split out so it can take the tint, as on the page. */
export type PassportOgStat =
  | { kind: "lorewards"; rank: string | null; text: string }
  | { kind: "plain"; text: string; muted: boolean };

export interface PassportOgNation {
  name: string;
  realm: string;
  /** "Founder", "Officer"; null for a plain member. */
  role: string | null;
  /** Raw stored flag; the route resolves and fetches it. */
  flagUrl: string | null;
}

export type PassportOgModel =
  | { kind: "generic"; title: string; description: string }
  | {
      kind: "passport";
      displayName: string;
      /** Font size in px, smaller for longer names so a name stays on one line. */
      nameSize: number;
      /** "@handle". */
      handle: string;
      /** Shown in the portrait well when there is no avatar. */
      initial: string;
      avatarUrl: string | null;
      nation: PassportOgNation | null;
      stats: PassportOgStat[];
    };

/** The realm fields the card reads (`RealmMetadataSource`); null for a draft or unknown realm. */
export interface RealmOgSource {
  name: string;
  nationCount: number;
  openCount: number;
  /** Raw stored banner; the route resolves and fetches it. */
  bannerUrl: string | null;
}

export interface RealmOgModel {
  kind: "realm" | "generic";
  name: string;
  /** Font size in px, smaller for longer names so a name stays on one line. */
  nameSize: number;
  /** "12 nations · 4 open to claim"; null for a realm with no nations, and on the generic card. */
  counts: string | null;
  bannerUrl: string | null;
  cta: string;
}

/** Longest text each line takes before it is clipped with an ellipsis. */
export const OG_TEXT_MAX = { name: 30, handle: 32, nation: 30, realm: 32 } as const;

const REALM_CTA = "Join on IxStates";
const GENERIC_REALM_NAME = "Realms";

/** `text` trimmed, and cut to `max` characters (ellipsis included) when longer. */
export function clipText(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

/** [longest length, font size] steps, then the size for anything longer. */
type SizeSteps = readonly [ReadonlyArray<readonly [number, number]>, number];

/**
 * Name sizes that keep a name on one line in Schibsted Grotesk Bold: the passport name column is
 * about 800px wide, the realm name column (beside the join pill) about 750px.
 */
const NAME_SIZES: Record<"passport" | "realm", SizeSteps> = {
  passport: [
    [
      [14, 76],
      [20, 64],
      [26, 54],
    ],
    46,
  ],
  realm: [
    [
      [16, 68],
      [22, 56],
      [28, 48],
    ],
    42,
  ],
};

function nameSize(name: string, [steps, smallest]: SizeSteps): number {
  return steps.find(([longest]) => name.length <= longest)?.[1] ?? smallest;
}

function cardNation(
  nation: NonNullable<Extract<PassportOgCard, { preview: true }>["primaryNation"]>
): PassportOgNation {
  return {
    name: clipText(nation.name.replace(/_/g, " "), OG_TEXT_MAX.nation),
    realm: clipText(nation.realm.name, OG_TEXT_MAX.nation),
    role: REALM_ROLE_LABEL[nation.role],
    flagUrl: nation.flagUrl,
  };
}

function cardStats(card: Extract<PassportOgCard, { preview: true }>): PassportOgStat[] {
  const stats: PassportOgStat[] = [];
  if (card.lorewards) {
    const { score, rank } = card.lorewards;
    stats.push({
      kind: "lorewards",
      rank: rank === null ? null : `#${rank.toLocaleString("en-US")}`,
      text: lorewardsLabel(score, null),
    });
  }
  const holdings = realmsAndNations(card.realmCount, card.nationCount);
  if (holdings) stats.push({ kind: "plain", text: holdings, muted: false });
  const since = sinceLabel(card.joinedAt?.toISOString() ?? null);
  if (since) stats.push({ kind: "plain", text: since, muted: true });
  return stats;
}

/** The passport card's content; the generic IxStates Passport card when there is no one to show. */
export function passportOgModel(card: PassportOgCard): PassportOgModel {
  if (!card?.preview) {
    return { kind: "generic", title: PASSPORT_TITLE, description: PASSPORT_GENERIC_DESCRIPTION };
  }
  const displayName = clipText(card.displayName, OG_TEXT_MAX.name) || card.handle;
  return {
    kind: "passport",
    displayName,
    nameSize: nameSize(displayName, NAME_SIZES.passport),
    handle: `@${clipText(card.handle, OG_TEXT_MAX.handle)}`,
    initial: displayName.charAt(0).toUpperCase(),
    avatarUrl: card.avatarUrl,
    nation: card.primaryNation ? cardNation(card.primaryNation) : null,
    stats: cardStats(card),
  };
}

/** The realm card's content; the generic Realms card for a draft or unknown realm. */
export function realmOgModel(source: RealmOgSource | null): RealmOgModel {
  if (!source) {
    return {
      kind: "generic",
      name: GENERIC_REALM_NAME,
      nameSize: nameSize(GENERIC_REALM_NAME, NAME_SIZES.realm),
      counts: null,
      bannerUrl: null,
      cta: REALM_CTA,
    };
  }
  const name = clipText(source.name, OG_TEXT_MAX.realm);
  return {
    kind: "realm",
    name,
    nameSize: nameSize(name, NAME_SIZES.realm),
    counts: realmCountsLine(source.nationCount, source.openCount),
    bannerUrl: source.bannerUrl,
    cta: REALM_CTA,
  };
}

/**
 * The passport guilloché for a `width` x `height` area as an SVG data URI, hairlines in `color` at
 * `opacity`: the pattern the page draws, sized for the image. Satori draws it as an `<img>`.
 */
export function guillocheDataUri(
  width: number,
  height: number,
  color: string,
  opacity: number
): string {
  const paths = guillochePaths(width, height)
    .map((d) => `<path d="${d}"/>`)
    .join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<g fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="1">${paths}</g></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
