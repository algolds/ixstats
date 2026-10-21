import { SYSTEM_REALM_IDS } from "./realm-ids";

/**
 * Realm URL slugs: 2–40 lower-case letters, digits or hyphens. Not `mine`, which is the forum's own
 * `/thinkpages/r/mine` (Your realm) route and would shadow a realm's board, and not a system realm's slug.
 * Shared by the admin form and adminCreateRealm.
 */
export const REALM_SLUG_PATTERN = new RegExp(
  `^(?!(?:${["mine", ...SYSTEM_REALM_IDS].join("|")})$)[a-z0-9-]{2,40}$`
);
