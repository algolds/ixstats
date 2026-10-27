import { z } from "zod";
import { publicProcedure } from "~/server/api/trpc";
import { realmScopeInput, viewerRealmId } from "~/server/api/trpc/realm-scope";

export const atomicProcedures = {
  // A country by name, for /maps?name= and the map tour (they read its id and capital). The
  // "atomic enhancement" figures it used to add (a third stability index and growth estimate) were
  // never shown and disagreed with MyCountry, so they are gone.
  getByNameWithAtomic: publicProcedure
    .input(z.object({ name: z.string(), ...realmScopeInput.shape }))
    .query(async ({ ctx, input }) => {
      // Names repeat across realms (ruling E-p): /maps?name= resolves in the viewer's realm.
      return ctx.db.country.findFirst({
        where: {
          realmId: await viewerRealmId(ctx, input.realm),
          name: { equals: input.name, mode: "insensitive" as const },
        },
        include: { nationalIdentity: true },
      });
    }),
};
