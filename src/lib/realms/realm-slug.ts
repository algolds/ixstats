/**
 * Realm URL slugs: 2–40 lower-case letters, digits or hyphens, and not `mine`, which is the forum's own
 * `/thinkpages/r/mine` (Your realm) route and would shadow a realm's board. Shared by the admin form and adminCreateRealm.
 */
export const REALM_SLUG_PATTERN = /^(?!mine$)[a-z0-9-]{2,40}$/;
