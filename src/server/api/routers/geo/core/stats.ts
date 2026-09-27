import { cachedPublicProcedure } from "~/server/api/trpc";

export const statsProcedures = {
  getMapStats: cachedPublicProcedure.query(async ({ ctx }) => {
    const [totalFeatures, politicalFeatures, linkedFeatures, unlinkedFeatures] = await Promise.all([
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
      ctx.db.country.count(),
      ctx.db.country.count({ where: { geometry: { not: null } as any } }),
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
