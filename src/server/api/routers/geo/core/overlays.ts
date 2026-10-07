import { z } from "zod";
import { cachedPublicProcedure } from "~/server/api/trpc";
import { realmScopeInput, viewerRealmId } from "~/server/api/trpc/realm-scope";
import { computeCrisisRiskFactors } from "~/lib/maps/geo-analytics";
import {
  deriveNationalHealthScore,
  deriveNetTradeBalance,
  type HealthInput,
} from "~/lib/maps/overlay-metrics";
import { parseAffectedCountries } from "~/lib/maps/crisis-affected-countries";
import { percentileRanks } from "./geometry";

/**
 * Weighted canon sources used by the Canon Density overlay. Each source is
 * counted once per country (via Prisma `groupBy`) and multiplied by its weight.
 */
const CANON_SOURCE_WEIGHTS = {
  storytellerEffect: 1,
  diplomaticEvent: 1,
  resolvedNationalIssue: 1,
  militaryConflict: 2,
  storyPin: 0.5,
} as const;

type CanonSourceName = keyof typeof CANON_SOURCE_WEIGHTS;

/**
 * Merge per-source per-country counts into a single weighted score map.
 * Countries with no canon activity get a score of 0.
 */
export function computeCanonDensityScores(
  countryIds: string[],
  sourceCounts: Record<CanonSourceName, Record<string, number>>
): Map<string, number> {
  const scores = new Map<string, number>();
  for (const id of countryIds) {
    scores.set(id, 0);
  }

  for (const [source, counts] of Object.entries(sourceCounts)) {
    const weight = CANON_SOURCE_WEIGHTS[source as CanonSourceName];
    for (const [countryId, count] of Object.entries(counts)) {
      const current = scores.get(countryId) ?? 0;
      scores.set(countryId, current + count * weight);
    }
  }

  return scores;
}

function normalizeCountMap(records: { id: string; _count: number }[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const r of records) {
    map[r.id] = r._count;
  }
  return map;
}

/** Overlays that take no other input: the listing is scoped to the viewer's realm (?realm= overrides). */
const realmScopedOverlayProcedure = cachedPublicProcedure.input(realmScopeInput.optional());

export const overlayProcedures = {
  getRegionalChoropleth: cachedPublicProcedure
    .input(
      z.object({
        metric: z.enum(["gdpPerCapita", "population", "vitality", "health", "tradeBalance"]),
        groupBy: z.enum(["country", "region", "continent"]).default("country"),
        ...realmScopeInput.shape,
      })
    )
    .query(async ({ ctx, input }) => {
      const countries = await ctx.db.country.findMany({
        where: { geometry: { not: null } as any, realmId: await viewerRealmId(ctx, input.realm) },
        select: {
          id: true,
          name: true,
          slug: true,
          geometry: true,
          centroid: true,
          continent: true,
          region: true,
          currentPopulation: true,
          currentGdpPerCapita: true,
          currentTotalGdp: true,
          economicVitality: true,
          landArea: true,
          lifeExpectancy: true,
          literacyRate: true,
          povertyRate: true,
          urbanPopulationPercent: true,
          populationWellbeing: true,
        },
      });

      // Derive trade balance from bilateral trade rows when requested.
      const tradeBalanceMap = new Map<string, number>();
      if (input.metric === "tradeBalance") {
        const trades = await ctx.db.bilateralTrade.findMany({
          select: {
            country1Id: true,
            country2Id: true,
            exportsFrom1: true,
            exportsFrom2: true,
            tradeBalance1: true,
          },
        });
        for (const c of countries) {
          tradeBalanceMap.set(c.id, deriveNetTradeBalance(c.id, trades));
        }
      }

      const getMetricValue = (c: (typeof countries)[number]): number => {
        switch (input.metric) {
          case "gdpPerCapita":
            return c.currentGdpPerCapita ?? 0;
          case "population": {
            // Population density (per km²) is more useful than raw population
            const area = c.landArea ?? 1;
            return area > 0 ? (c.currentPopulation ?? 0) / area : 0;
          }
          case "vitality":
            return c.economicVitality ?? 0;
          case "health":
            return deriveNationalHealthScore({
              lifeExpectancy: c.lifeExpectancy,
              literacyRate: c.literacyRate,
              povertyRate: c.povertyRate,
              urbanPopulationPercent: c.urbanPopulationPercent,
              populationWellbeing: c.populationWellbeing,
              economicVitality: c.economicVitality,
              currentGdpPerCapita: c.currentGdpPerCapita,
            } satisfies HealthInput);
          case "tradeBalance":
            return tradeBalanceMap.get(c.id) ?? 0;
          default:
            return 0;
        }
      };

      // Trade balance is signed: negative = deficit, positive = surplus. The
      // sequential color scale maps low rank to surplus and high rank to deficit,
      // so we invert the rank value for that metric.
      const getRankValue = (c: (typeof countries)[number]): number => {
        if (input.metric === "tradeBalance") {
          return -(getMetricValue(c) || 0);
        }
        return getMetricValue(c);
      };

      if (input.groupBy === "country") {
        // Compute percentile rank (0–1) for each country so colors distribute evenly.
        // Raw values go in rawValue for tooltips. `value` is the normalized rank.
        const rankMap = percentileRanks(
          countries.map((c) => ({ id: c.id, value: getRankValue(c) }))
        );

        return {
          type: "FeatureCollection" as const,
          features: countries.map((c) => ({
            type: "Feature" as const,
            geometry: c.geometry as unknown as import("geojson").Geometry,
            properties: {
              id: c.id,
              name: c.name,
              slug: c.slug,
              value: rankMap.get(c.id) ?? 0, // 0–1 percentile rank
              rawValue: getMetricValue(c),
              metric: input.metric,
              continent: c.continent,
              region: c.region,
            },
          })),
          metadata: {
            metric: input.metric,
            groupBy: input.groupBy,
            minVal: 0,
            maxVal: 1,
            count: countries.length,
          },
        };
      }

      // Region/continent aggregation
      const groups = new Map<string, { values: number[]; countryIds: string[]; names: string[] }>();
      for (const c of countries) {
        const key =
          input.groupBy === "region" ? (c.region ?? "Unknown") : (c.continent ?? "Unknown");
        if (!groups.has(key)) groups.set(key, { values: [], countryIds: [], names: [] });
        const g = groups.get(key)!;
        g.values.push(getMetricValue(c));
        g.countryIds.push(c.id);
        g.names.push(c.name);
      }

      // Aggregate per group, then rank groups by percentile
      const groupAgg = new Map<string, number>();
      for (const [key, g] of groups) {
        const avg = g.values.reduce((s, v) => s + v, 0) / g.values.length;
        groupAgg.set(
          key,
          input.metric === "population" ? g.values.reduce((s, v) => s + v, 0) : avg
        );
      }

      // Rank groups by percentile (0–1). Invert trade balance so deficits rank high.
      const sortedGroups = Array.from(groupAgg.entries()).sort((a, b) => {
        const diff = a[1] - b[1];
        return input.metric === "tradeBalance" ? -diff : diff;
      });
      const groupRank = new Map<string, number>();
      for (let i = 0; i < sortedGroups.length; i++) {
        groupRank.set(
          sortedGroups[i]![0],
          sortedGroups.length > 1 ? i / (sortedGroups.length - 1) : 0.5
        );
      }

      return {
        type: "FeatureCollection" as const,
        features: countries.map((c) => {
          const key =
            input.groupBy === "region" ? (c.region ?? "Unknown") : (c.continent ?? "Unknown");
          return {
            type: "Feature" as const,
            geometry: c.geometry as unknown as import("geojson").Geometry,
            properties: {
              id: c.id,
              name: c.name,
              slug: c.slug,
              value: groupRank.get(key) ?? 0,
              rawValue: groupAgg.get(key) ?? 0,
              metric: input.metric,
              groupName: key,
              groupBy: input.groupBy,
            },
          };
        }),
        metadata: {
          metric: input.metric,
          groupBy: input.groupBy,
          minVal: 0,
          maxVal: 1,
          count: groups.size,
        },
      };
    }),

  /**
   * Canon Density — weighted, deterministic story-activity heatmap.
   *
   * Counts canon events per country using Prisma `groupBy`, then combines them
   * with source-specific weights. The returned `value` is a percentile rank
   * (0–1) so colors distribute evenly across the active range.
   */
  getCanonDensity: realmScopedOverlayProcedure.query(async ({ ctx, input }) => {
    const countries = await ctx.db.country.findMany({
      where: { geometry: { not: null } as any, realmId: await viewerRealmId(ctx, input?.realm) },
      select: {
        id: true,
        name: true,
        slug: true,
        geometry: true,
        centroid: true,
        continent: true,
        region: true,
      },
    });

    const countryIds = countries.map((c) => c.id);

    // Per-source groupBy counts (single round-trip per source, no N+1).
    const [
      storytellerEffects,
      diplomaticEvents,
      resolvedIssues,
      conflictsAsInitiator,
      conflictsAsDefender,
      storyPins,
    ] = await Promise.all([
      ctx.db.storytellerEffect.groupBy({
        by: ["countryId"],
        where: { countryId: { not: null } },
        _count: { _all: true },
      }),
      ctx.db.diplomaticEvent.groupBy({
        by: ["country1Id"],
        _count: { _all: true },
      }),
      ctx.db.nationalIssue.groupBy({
        by: ["countryId"],
        where: { status: { in: ["responded", "auto_resolved"] } },
        _count: { _all: true },
      }),
      ctx.db.militaryConflict.groupBy({
        by: ["initiatorId"],
        _count: { _all: true },
      }),
      ctx.db.militaryConflict.groupBy({
        by: ["defenderId"],
        _count: { _all: true },
      }),
      ctx.db.storyPin.groupBy({
        by: ["countryId"],
        where: { status: { not: "rejected" } },
        _count: { _all: true },
      }),
    ]);

    // Aggregate military conflict counts from both sides.
    const conflictCounts: Record<string, number> = {};
    for (const side of [conflictsAsInitiator, conflictsAsDefender]) {
      for (const row of side) {
        const id = "initiatorId" in row ? row.initiatorId : row.defenderId;
        conflictCounts[id] = (conflictCounts[id] ?? 0) + row._count._all;
      }
    }

    const sourceCounts = {
      storytellerEffect: normalizeCountMap(
        // Prisma groupBy by a nullable field still includes the null bucket; filter it out.
        storytellerEffects
          .filter((r): r is typeof r & { countryId: string } => r.countryId !== null)
          .map((r) => ({ id: r.countryId, _count: r._count._all }))
      ),
      diplomaticEvent: normalizeCountMap(
        diplomaticEvents.map((r) => ({ id: r.country1Id, _count: r._count._all }))
      ),
      resolvedNationalIssue: normalizeCountMap(
        resolvedIssues.map((r) => ({ id: r.countryId, _count: r._count._all }))
      ),
      militaryConflict: conflictCounts,
      storyPin: normalizeCountMap(
        storyPins.map((r) => ({ id: r.countryId, _count: r._count._all }))
      ),
    };

    const scores = computeCanonDensityScores(countryIds, sourceCounts);

    // Percentile rank across all countries with geometry.
    const rankMap = percentileRanks(
      countries.map((c) => ({ id: c.id, value: scores.get(c.id) ?? 0 }))
    );

    const maxScore = Math.max(1, ...Array.from(scores.values()));

    return {
      type: "FeatureCollection" as const,
      features: countries.map((c) => ({
        type: "Feature" as const,
        geometry: c.geometry as unknown as import("geojson").Geometry,
        properties: {
          id: c.id,
          name: c.name,
          slug: c.slug,
          value: rankMap.get(c.id) ?? 0,
          rawValue: scores.get(c.id) ?? 0,
          metric: "canonDensity",
          continent: c.continent,
          region: c.region,
        },
      })),
      metadata: {
        metric: "canonDensity",
        minVal: 0,
        maxVal: maxScore,
        count: countries.length,
      },
    };
  }),

  /**
   * 4.3 — Crisis Risk Map: Return per-country risk scores as a GeoJSON
   * FeatureCollection for heatmap coloring, plus active crisis events.
   */
  getCrisisRiskMap: cachedPublicProcedure
    .input(
      z
        .object({
          riskType: z
            .enum(["hurricane", "earthquake", "drought", "flood", "wildfire", "pandemic", "famine"])
            .optional(),
          ...realmScopeInput.shape,
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const realmId = await viewerRealmId(ctx, input?.realm);
      // Get pre-computed geo profiles with crisis risk data
      const profiles = await ctx.db.countryGeoProfile.findMany({
        where: { country: { realmId } },
        select: {
          countryId: true,
          climateDistribution: true,
          elevationProfile: true,
          arableLandPercent: true,
          coastlineKm: true,
          isLandlocked: true,
          neighborCount: true,
          terrainRoughness: true,
          meanElevation: true,
          country: {
            select: { name: true, slug: true, geometry: true },
          },
        },
      });

      // Also get active crisis events for point markers
      const activeCrises = await ctx.db.crisisEvent.findMany({
        where: { responseStatus: { not: "resolved" } },
        select: {
          id: true,
          title: true,
          type: true,
          severity: true,
          location: true,
          affectedCountries: true,
        },
        take: 50,
      });

      // For each country, compute risk from their geo profile
      const riskFeatures = [];
      for (const p of profiles) {
        if (!p.country.geometry) continue;

        // Re-compute risk factors from the stored profile data
        const risk = computeCrisisRiskFactors({
          coastlineKm: p.coastlineKm ?? 0,
          isLandlocked: p.isLandlocked ?? false,
          isIsland: false,
          arableLandPercent: p.arableLandPercent ?? 50,
          climateDiversity: 0.5,
          terrainRoughness: p.terrainRoughness ?? 0,
          meanElevation: p.meanElevation ?? 200,
          neighborCount: p.neighborCount ?? 0,
          dominantClimate: "",
          dominantElevation: "",
          drainageDensity: 0,
        } as any);

        const riskType = input?.riskType;
        const riskScore = riskType ? (risk[riskType] ?? 0) : Math.max(...Object.values(risk));

        riskFeatures.push({
          type: "Feature" as const,
          geometry: p.country.geometry as unknown as import("geojson").Geometry,
          properties: {
            id: p.countryId,
            name: p.country.name,
            slug: p.country.slug,
            riskScore,
            riskType: riskType ?? "max",
            ...risk,
          },
        });
      }

      // Crisis event points (using affected country centroids as fallback locations).
      // affectedCountries holds country IDs (JSON array; legacy rows comma-separated);
      // names are matched too in case older rows stored names.
      const refsByCrisis = activeCrises.map((ce) => parseAffectedCountries(ce.affectedCountries));
      const allRefs = [...new Set(refsByCrisis.flat())];
      const refCountries =
        allRefs.length > 0
          ? await ctx.db.country.findMany({
              where: { realmId, OR: [{ id: { in: allRefs } }, { name: { in: allRefs } }] },
              select: { id: true, name: true, centroid: true },
            })
          : [];
      const countryByRef = new Map<string, (typeof refCountries)[number]>();
      for (const c of refCountries) {
        countryByRef.set(c.id, c);
        countryByRef.set(c.name, c);
      }

      const crisisPoints = [];
      for (const [i, ce] of activeCrises.entries()) {
        const country = (refsByCrisis[i] ?? [])
          .map((ref) => countryByRef.get(ref))
          .find((c) => c?.centroid);
        if (!country?.centroid) continue;
        const coords = (country.centroid as { coordinates: [number, number] }).coordinates;
        crisisPoints.push({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: coords },
          properties: {
            id: ce.id,
            title: ce.title,
            type: ce.type,
            severity: ce.severity,
            countryName: country.name,
          },
        });
      }

      return {
        riskMap: { type: "FeatureCollection" as const, features: riskFeatures },
        crisisEvents: { type: "FeatureCollection" as const, features: crisisPoints },
      };
    }),

  /**
   * 4.4 — Geopolitical Overlay: Alliance groups, diplomatic relations, and conflicts
   * as GeoJSON for network-style map visualization.
   */
  getGeopoliticalOverlay: realmScopedOverlayProcedure.query(async ({ ctx, input }) => {
    const realmId = await viewerRealmId(ctx, input?.realm);
    // 1. Alliance groups
    const alliances = await ctx.db.alliance.findMany({
      where: { visibility: "public", realmId },
      select: {
        id: true,
        name: true,
        type: true,
        color: true,
        members: {
          select: {
            countryId: true,
            role: true,
          },
        },
      },
    });

    const allianceGroups = alliances.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      color: a.color ?? "#888888",
      memberCountryIds: a.members.map((m) => m.countryId),
    }));

    // 2. Diplomatic relations as lines between country centroids
    const relations = await ctx.db.diplomaticRelation.findMany({
      where: {
        strength: { gt: 0 },
      },
      select: {
        country1: true,
        country2: true,
        relationship: true,
        strength: true,
      },
      take: 100,
      orderBy: { strength: "desc" },
    });

    const uniqueCountryIds = Array.from(
      new Set(relations.flatMap((r) => [r.country1, r.country2]))
    );

    const relationCountries = await ctx.db.country.findMany({
      where: { id: { in: uniqueCountryIds }, realmId },
      select: { id: true, name: true, centroid: true },
    });

    const relationCountryMap = new Map(relationCountries.map((c) => [c.id, c]));

    const relationFeatures = [];
    for (const r of relations) {
      const country1Obj = relationCountryMap.get(r.country1);
      const country2Obj = relationCountryMap.get(r.country2);
      if (!country1Obj || !country2Obj) continue;

      const c1 = country1Obj.centroid as { coordinates: [number, number] } | null;
      const c2 = country2Obj.centroid as { coordinates: [number, number] } | null;
      if (!c1 || !c2) continue;

      const relType = (r.relationship ?? "neutral").toLowerCase();
      const color =
        relType.includes("friend") || relType.includes("ally")
          ? "#22c55e"
          : relType.includes("hostil") || relType.includes("rival")
            ? "#ef4444"
            : "#f59e0b";

      relationFeatures.push({
        type: "Feature" as const,
        geometry: { type: "LineString" as const, coordinates: [c1.coordinates, c2.coordinates] },
        properties: {
          country1Name: country1Obj.name,
          country2Name: country2Obj.name,
          relationship: r.relationship,
          strength: r.strength,
          color,
        },
      });
    }

    // 3. Active military conflicts as point markers
    const conflicts = await ctx.db.militaryConflict.findMany({
      where: { status: { in: ["active", "proposed", "accepted"] }, initiator: { realmId } },
      select: {
        id: true,
        type: true,
        status: true,
        initiator: { select: { name: true, centroid: true } },
        defender: { select: { name: true, centroid: true } },
      },
      take: 20,
    });

    const conflictFeatures = [];
    for (const c of conflicts) {
      const c1 = c.initiator.centroid as { coordinates: [number, number] } | null;
      const c2 = c.defender.centroid as { coordinates: [number, number] } | null;
      if (!c1 || !c2) continue;

      // Place marker at midpoint
      const midLng = (c1.coordinates[0] + c2.coordinates[0]) / 2;
      const midLat = (c1.coordinates[1] + c2.coordinates[1]) / 2;

      conflictFeatures.push({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [midLng, midLat] as [number, number] },
        properties: {
          id: c.id,
          type: c.type,
          status: c.status,
          initiatorName: c.initiator.name,
          defenderName: c.defender.name,
        },
      });
    }

    return {
      allianceGroups,
      relations: { type: "FeatureCollection" as const, features: relationFeatures },
      conflicts: { type: "FeatureCollection" as const, features: conflictFeatures },
    };
  }),
};
