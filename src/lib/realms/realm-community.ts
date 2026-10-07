/**
 * Realm community links and the in-world date (docs/specs/2026-10-05-realm-regions-design.md): what founders and
 * officers with the `appearance` power set, how it is validated and how the date reads. Client-safe.
 */
import { z } from "zod";

/** What a community link points at; each kind has its own icon on the realm page. */
export const REALM_LINK_KINDS = ["forum", "discord", "wiki", "map", "website", "other"] as const;

export type RealmLinkKind = (typeof REALM_LINK_KINDS)[number];

export const REALM_LINK_KIND_LABELS: Record<RealmLinkKind, string> = {
  forum: "Forum",
  discord: "Discord",
  wiki: "Wiki",
  map: "Map",
  website: "Website",
  other: "Other",
};

export const MAX_REALM_LINKS = 8;
export const MAX_REALM_LINK_LABEL = 40;
export const MAX_REALM_LINK_URL = 500;

/**
 * A community link address: an absolute `https://` URL with a dotted host and no credentials. Everything else
 * (`http:`, `javascript:`, `data:`, relative paths) is refused.
 */
export function isRealmLinkUrl(url: string): boolean {
  const value = url.trim();
  if (value === "" || value.length > MAX_REALM_LINK_URL || /\s/.test(value)) return false;
  if (!/^https:\/\//i.test(value)) return false;
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname.includes(".") &&
      parsed.username === "" &&
      parsed.password === ""
    );
  } catch {
    return false;
  }
}

export const RealmLinkSchema = z.object({
  label: z.string().trim().min(1).max(MAX_REALM_LINK_LABEL),
  url: z
    .string()
    .trim()
    .max(MAX_REALM_LINK_URL)
    .refine(isRealmLinkUrl, "Use a full https:// address"),
  kind: z.enum(REALM_LINK_KINDS),
});

export type RealmLink = z.infer<typeof RealmLinkSchema>;

export const RealmLinksSchema = z.array(RealmLinkSchema).max(MAX_REALM_LINKS);

/** `Realm.communityLinks` as stored: invalid entries (and anything past the limit) are dropped, never shown. */
export function parseRealmLinks(stored: unknown): RealmLink[] {
  if (!Array.isArray(stored)) return [];
  return stored
    .map((entry) => RealmLinkSchema.safeParse(entry))
    .flatMap((result) => (result.success ? [result.data] : []))
    .slice(0, MAX_REALM_LINKS);
}

export const MAX_IN_WORLD_LABEL = 60;
export const MAX_IN_WORLD_ERA = 16;
export const MAX_IN_WORLD_OFFSET = 100_000;

/**
 * The realm's in-world date (`Realm.settings.inWorldDate`), display only: the simulation keeps the shared IxTime
 * clock. Either a label the founder sets (optionally "as of" a real date), or a year that follows the real one
 * (in-world year = real year + offset, then the era).
 */
export const InWorldDateSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("fixed"),
    label: z.string().trim().min(1).max(MAX_IN_WORLD_LABEL),
    asOf: z.iso.date().nullish(),
  }),
  z.object({
    mode: z.literal("offset"),
    offset: z.number().int().min(-MAX_IN_WORLD_OFFSET).max(MAX_IN_WORLD_OFFSET),
    era: z.string().trim().max(MAX_IN_WORLD_ERA).nullish(),
  }),
]);

export type InWorldDate = z.infer<typeof InWorldDateSchema>;

/** The stored setting, or null when it is missing or malformed. */
export function parseInWorldDate(stored: unknown): InWorldDate | null {
  const parsed = InWorldDateSchema.safeParse(stored);
  return parsed.success ? parsed.data : null;
}

export interface InWorldDateLabel {
  /** "14 Harvest 1203 AE", or "2041 AE" for a yearly offset. */
  label: string;
  /** The real date a fixed label was set for (YYYY-MM-DD), if the founder gave one. */
  asOf: string | null;
}

/** How the in-world date reads on `now` (the real date; only the offset mode depends on it). */
export function formatInWorldDate(
  setting: InWorldDate | null,
  now: Date = new Date()
): InWorldDateLabel | null {
  if (!setting) return null;
  if (setting.mode === "fixed") return { label: setting.label, asOf: setting.asOf ?? null };
  const year = now.getUTCFullYear() + setting.offset;
  const era = setting.era?.trim();
  return { label: era ? `${year} ${era}` : `Year ${year}`, asOf: null };
}
