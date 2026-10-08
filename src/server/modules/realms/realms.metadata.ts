/**
 * Page metadata for `/r/{slug}` and its pages (`src/app/r/[realm]/(region)/layout.tsx`): what link unfurlers
 * (Discord, Slack) and search engines read. Draft and generating realms give nothing, so the root
 * defaults stand and nothing about an unpublished realm leaks. Images are left to the route's
 * `opengraph-image.tsx`, which Next attaches on its own and which reads the same source.
 */
import type { Metadata } from "next";
import type { PrismaClient } from "@prisma/client";
import { realmCountsLine } from "~/lib/realms/realm-region";
import { NOINDEX, SITE_NAME, socialMetadata } from "~/lib/site-metadata";
import { stripHtml } from "~/lib/utils/sanitize-html";
import { isRealmOpen, isRealmPublished } from "./realms.access";

/** What the realm page's metadata is built from. */
export interface RealmMetadataSource {
  name: string;
  /** Unlisted realms are kept out of search results (they still unfurl when shared). */
  unlisted: boolean;
  /** The founder's short description, trimmed; null when blank. */
  description: string | null;
  /** The factbook as plain text; null when there is none. */
  factbookText: string | null;
  tags: string[];
  nationCount: number;
  /** Unclaimed nations while the realm takes claims; 0 once it is closed (archived). */
  openCount: number;
  /** Raw stored region banner (`Realm.bannerUrl`), trimmed; null when none. Resolve before use. */
  bannerUrl: string | null;
}

const DESCRIPTION_MAX = 160;

/** The realm's name, text and nation counts by slug; null for a draft, generating or unknown realm. */
export async function loadRealmMetadataSource(
  db: Pick<PrismaClient, "realm" | "country">,
  slug: string
): Promise<RealmMetadataSource | null> {
  const realm = await db.realm.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      status: true,
      visibility: true,
      description: true,
      factbookHtml: true,
      tags: true,
      bannerUrl: true,
    },
  });
  if (!realm || !isRealmPublished(realm.id, realm.status)) return null;

  const [nationCount, claimedCount] = await Promise.all([
    db.country.count({ where: { realmId: realm.id } }),
    db.country.count({ where: { realmId: realm.id, ownerUserId: { not: null } } }),
  ]);
  return {
    name: realm.name,
    unlisted: realm.visibility === "unlisted",
    description: realm.description?.trim() || null,
    factbookText: realm.factbookHtml ? stripHtml(realm.factbookHtml) || null : null,
    tags: realm.tags,
    nationCount,
    openCount: isRealmOpen(realm.id, realm.status) ? nationCount - claimedCount : 0,
    bannerUrl: realm.bannerUrl?.trim() || null,
  };
}

/** `text` cut to the description length at a word boundary, with an ellipsis when cut. */
function clip(text: string): string {
  if (text.length <= DESCRIPTION_MAX) return text;
  const cut = text.slice(0, DESCRIPTION_MAX);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** The founder's description, else the factbook, else the tags, else the nation counts. */
function realmDescription(source: RealmMetadataSource): string | null {
  const text = source.description ?? source.factbookText;
  if (text) return clip(text);
  if (source.tags.length > 0) return source.tags.join(", ");
  return realmCountsLine(source.nationCount, source.openCount);
}

/**
 * The realm pages' metadata; `{}` for a draft or unknown realm (null source). No canonical and no
 * og:url: it is set by the `(region)` layout, so every child page (board, nations, rules, the realm
 * passport) inherits it and would otherwise be canonicalised to the overview.
 */
export function realmMetadata(source: RealmMetadataSource | null): Metadata {
  if (!source) return {};
  const description = realmDescription(source) ?? undefined;
  return {
    ...socialMetadata(source.name, description, {
      type: "website",
      siteName: SITE_NAME,
      title: source.name,
      description,
    }),
    ...(source.unlisted ? NOINDEX : {}),
  };
}
