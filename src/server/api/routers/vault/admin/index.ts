/**
 * Vault Admin Router — split across domain subrouters and recombined here via mergeRouters.
 */
import { mergeRouters } from "~/server/api/trpc";
import { vaultAdminUsersRouter } from "./users";
import { vaultAdminStoreRouter } from "./store";
import { vaultAdminItemsRouter } from "./items";

export { vaultTransactionTypeEnum } from "./users";

export const vaultAdminRouter = mergeRouters(
  vaultAdminUsersRouter,
  vaultAdminStoreRouter,
  vaultAdminItemsRouter
);
