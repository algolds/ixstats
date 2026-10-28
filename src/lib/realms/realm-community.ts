/**
 * Realm community links (docs/history/specs/2026-10-05-realm-regions-design.md): what founders and officers with the
 * `appearance` power set and how it is validated. Client-safe. (The realm's date is its clock: realm-clock.ts.)
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
