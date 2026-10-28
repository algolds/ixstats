/**
 * Native lore of a country (docs/specs/2026-10-24-native-lore-design.md): who may write it, its Lore tab
 * pieces, the owner's curation and the lore team. Thin: validates, injects identity (lore modules do not read it) and
 * calls ~/server/modules/lore, which checks access on every write.
 */
import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  publicReadOnlyProcedure,
  rateLimitedMutationProcedure,
  readOnlyProcedure,
} from "~/server/api/trpc";
import { LORE_TYPES } from "~/lib/lore/lore-types";
import {
  addExistingPiece,
  addLoreAuthor,
  getLoreAccess,
  listLorePieces,
  listLoreTeam,
  recordPiece,
  removeLoreAuthor,
  setCuration,
  type LoreIdentity,
} from "~/server/modules/lore/lore.service";
import { loadPlayerNames } from "~/server/modules/identity/identity.player-names";
import { resolveHandleUser } from "~/server/modules/identity/identity.resolve";

/** Co-authors resolve by any passport handle and are named by the identity rule. */
const identity: LoreIdentity = {
  userOfHandle: async (handle) => (await resolveHandleUser(handle))?.id ?? null,
  namesOf: loadPlayerNames,
};

const countryId = z.string().min(1).max(64);
const title = z.string().trim().min(1).max(255);
const type = z.enum(LORE_TYPES);
const country = z.object({ countryId });

export const countryLoreRouter = createTRPCRouter({
  access: publicProcedure
    .input(country)
    .query(({ ctx, input }) => getLoreAccess(ctx, input.countryId)),

  list: publicReadOnlyProcedure
    .input(country)
    .query(({ ctx, input }) => listLorePieces(ctx, input.countryId)),

  recordPiece: rateLimitedMutationProcedure
    .input(z.object({ countryId, title, type }))
    .mutation(({ ctx, input }) => recordPiece(ctx, input.countryId, input)),

  setCuration: rateLimitedMutationProcedure
    .input(
      z.object({ countryId, title, pinned: z.boolean().optional(), hidden: z.boolean().optional() })
    )
    .mutation(({ ctx, input }) => setCuration(ctx, input.countryId, input)),

  addExisting: rateLimitedMutationProcedure
    .input(z.object({ countryId, title, type }))
    .mutation(({ ctx, input }) => addExistingPiece(ctx, input.countryId, input)),

  team: readOnlyProcedure
    .input(country)
    .query(({ ctx, input }) => listLoreTeam(ctx, input.countryId, identity)),

  addAuthor: rateLimitedMutationProcedure
    .input(z.object({ countryId, handle: z.string().trim().min(1).max(80) }))
    .mutation(({ ctx, input }) => addLoreAuthor(ctx, input.countryId, input.handle, identity)),

  removeAuthor: rateLimitedMutationProcedure
    .input(z.object({ countryId, userId: z.string().min(1).max(64) }))
    .mutation(({ ctx, input }) => removeLoreAuthor(ctx, input.countryId, input.userId)),
});
