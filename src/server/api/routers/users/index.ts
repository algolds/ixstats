/**
 * Users router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.users.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - profile:         user record CRUD, profile lookups (by id / batch / social / abilities / role)
 *  - country-linking: setActiveNation, membership status and tier
 *  - preferences:     wiki preferences (get/update) + resolveWikiAuthor
 *  - admin:           getActiveUsers, admin favorites (add/remove/list/reorder), setupDatabase
 *  - account-deletion: get/request/cancel the account deletion request (Privacy 5.2)
 */
import { mergeRouters } from "~/server/api/trpc";
import { usersProfileRouter } from "./profile";
import { usersCountryLinkingRouter } from "./country-linking";
import { usersPreferencesRouter } from "./preferences";
import { usersAdminRouter } from "./admin";
import { usersAccountDeletionRouter } from "./account-deletion";

export const usersRouter = mergeRouters(
  usersProfileRouter,
  usersCountryLinkingRouter,
  usersPreferencesRouter,
  usersAdminRouter,
  usersAccountDeletionRouter
);
