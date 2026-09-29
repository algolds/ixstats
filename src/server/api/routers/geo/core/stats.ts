import { cachedPublicProcedure } from "~/server/api/trpc";
import { realmScopeInput, viewerRealmId } from "~/server/api/trpc/realm-scope";

export const statsProcedures = {
  getMapStats: cachedPublicProcedure
    .input(realmScopeInput.optional())
    .query(async ({ ctx, input }) => {
      const realmId = await viewerRealmId(ctx, input?.realm);
      const [totalFeatures, politicalFeatures, linkedFeatures, unlinkedFeatures] =
        await Promise.all([
          ctx.db.mapLayer.count({ where: { isActive: true } }),
          ctx.db.mapLayer.count({
            where: { layerType: "political", isActive: true },
          }),
          ctx.db.mapLayer.count({
            where: {
              layerType: "political",
              isActive: true,
              countryId: { not: null },
            },
          }),
          ctx.db.mapLayer.count({
            where: {
              layerType: "political",
              isActive: true,
              countryId: null,
            },
          }),
        ]);

      const [totalCountries, countriesWithGeometry] = await Promise.all([
        ctx.db.country.count({ where: { realmId } }),
        ctx.db.country.count({ where: { geometry: { not: null } as any, realmId } }),
      ]);

      return {
        totalFeatures,
        politicalFeatures,
        linkedFeatures,
        unlinkedFeatures,
        totalCountries,
        countriesWithGeometry,
        linkageRate:
          politicalFeatures > 0 ? Math.round((linkedFeatures / politicalFeatures) * 100) : 0,
      };
    }),
};
