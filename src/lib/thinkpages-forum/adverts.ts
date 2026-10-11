/**
 * Find a Realm adverts (docs/superpowers/specs/2026-10-10-thinkpages-forum-realm-adverts-design.md). Pure: no Prisma,
 * no DOM. An advert is a thread in the sitewide Find a Realm category whose `advertRealmId` names the realm it advertises.
 */

export const ADVERT_CATEGORY_KEY = "find-a-realm";

/** Whether this is the sitewide Find a Realm category (a realm section never has one, whatever a key says). */
export function isAdvertCategory(category: { key: string; scope?: string }): boolean {
  return (
    category.key === ADVERT_CATEGORY_KEY &&
    (category.scope === undefined || category.scope === "site")
  );
}

/** Realm statuses nobody but the realm's staff can see (see `isRealmHiddenFrom`): the realms rule, shared. */
export { UNPUBLISHED_REALM_STATUSES } from "~/lib/realms/realm-ids";

export const ADVERT_ONLY_NOTICE =
  "Find a Realm takes realm adverts only. A realm's founder or officers start one from the realm's Manage page; anyone signed in can reply to ask questions.";
export const ADVERT_POWER_NOTICE =
  "Only the realm's founder and officers with the Appearance power can manage its advert.";
export const ADVERT_ARCHIVED_NOTICE =
  "An archived realm cannot be advertised, and its advert stays locked.";
export const ADVERT_EXISTS_NOTICE = "This realm already has an advert.";
export const ADVERT_HIDDEN_NOTICE = "Your realm's advert was hidden by a moderator.";
export const ADVERT_IXWORLD_NOTICE = "IxWorld has no advert.";
export const ADVERT_UNLOCK_NOTICE = "Only a moderator can unlock an advert.";
