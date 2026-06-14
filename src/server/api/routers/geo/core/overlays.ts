import { z } from "zod";
import { cachedPublicProcedure } from "~/server/api/trpc";
// eslint-disable-next-line unused-imports/no-unused-imports
import type { FeatureCollection, Feature, Geometry } from "geojson";
import { computeCrisisRiskFactors } from "~/lib/geo-analytics";

export const overlayProcedures = {
  getRegionalChoropleth: cachedPublicProcedure
    .input(
      z.object({
        metric: z.enum(["gdpPerCapita", "population", "vitality", "health", "tradeBalance"]),
        groupBy: z.enum(["country", "region", "continent"]).default("country"),
      })
    )
    .query(async ({ ctx, input }) => {
      const countries = await ctx.db.country.findMany({
        where: { geometry: { not: null } as any },
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
          overallNationalHealth: true,
          tradeBalance: true,
          landArea: true,
        },
      });

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
            return c.overallNationalHealth ?? 0;
          case "tradeBalance":
            return c.tradeBalance ?? 0;
          default:
            return 0;
        }
      };

      if (input.groupBy === "country") {
        // Compute percentile rank (0–1) for each country so colors distribute evenly.
        // Raw values go in rawValue for tooltips. `value` is the normalized rank.
        const rawValues = countries.map((c) => ({ c, raw: getMetricValue(c) }));
        const sorted = [...rawValues].sort((a, b) => a.raw - b.raw);
        const rankMap = new Map<string, number>();
        for (let i = 0; i < sorted.length; i++) {
          rankMap.set(sorted[i]!.c.id, sorted.length > 1 ? i / (sorted.length - 1) : 0.5);
        }

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

      // Rank groups by percentile (0–1)
      const sortedGroups = Array.from(groupAgg.entries()).sort((a, b) => a[1] - b[1]);
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
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      // Get pre-computed geo profiles with crisis risk data
      const profiles = await ctx.db.countryGeoProfile.findMany({
        select: {
          countryId: true,
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
        const geoProfile = await ctx.db.countryGeoProfile.findUnique({
          where: { countryId: p.countryId },
          select: {
            climateDistribution: true,
            elevationProfile: true,
            arableLandPercent: true,
            coastlineKm: true,
            isLandlocked: true,
            neighborCount: true,
            terrainRoughness: true,
            meanElevation: true,
          },
        });

        if (!geoProfile) continue;

        const risk = computeCrisisRiskFactors({
          coastlineKm: geoProfile.coastlineKm ?? 0,
          isLandlocked: geoProfile.isLandlocked ?? false,
          isIsland: false,
          arableLandPercent: geoProfile.arableLandPercent ?? 50,
          climateDiversity: 0.5,
          terrainRoughness: geoProfile.terrainRoughness ?? 0,
          meanElevation: geoProfile.meanElevation ?? 200,
          neighborCount: geoProfile.neighborCount ?? 0,
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

      // Crisis event points (using affected country centroids as fallback locations)
      const crisisPoints = [];
      for (const ce of activeCrises) {
        const affected = ce.affectedCountries as string[] | null;
        if (affected && affected.length > 0) {
          const country = await ctx.db.country.findFirst({
            where: { name: { in: affected } },
            select: { centroid: true, name: true },
          });
          if (country?.centroid) {
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
        }
      }

      return {
        riskMap: { type: "FeatureCollection" as const, features: riskFeatures },
        crisisEvents: { type: "FeatureCollection" as const, features: crisisPoints },
      };
    }),

  /**
   * 4.2 — Trade Routes: Return bilateral trade data as GeoJSON LineStrings
   * connecting country centroids, styled by volume and balance.
   */
  getTradeRouteGeoJSON: cachedPublicProcedure
    .input(
      z
        .object({
          minVolume: z.number().optional(),
          limit: z.number().min(1).max(200).default(50),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const trades = await ctx.db.bilateralTrade.findMany({
        where: input?.minVolume ? { tradeVolume: { gte: input.minVolume } } : undefined,
        orderBy: { tradeVolume: "desc" },
        take: input?.limit ?? 50,
        select: {
          id: true,
          tradeVolume: true,
          exportsFrom1: true,
          exportsFrom2: true,
          tradeBalance1: true,
          commodities: true,
          country1: { select: { id: true, name: true, slug: true, centroid: true } },
          country2: { select: { id: true, name: true, slug: true, centroid: true } },
        },
      });

      const features = [];
      for (const t of trades) {
        const c1 = t.country1.centroid as { coordinates: [number, number] } | null;
        const c2 = t.country2.centroid as { coordinates: [number, number] } | null;
        if (!c1 || !c2) continue;

        const balance = t.tradeBalance1 ?? 0;
        features.push({
          type: "Feature" as const,
          geometry: {
            type: "LineString" as const,
            coordinates: [c1.coordinates, c2.coordinates],
          },
          properties: {
            id: t.id,
            volume: t.tradeVolume ?? 0,
            balance,
            // Color hint: positive = country1 surplus (green), negative = deficit (red), near zero = balanced (blue)
            balanceColor: Math.abs(balance) < 1e6 ? "#3b82f6" : balance > 0 ? "#22c55e" : "#ef4444",
            commodities: t.commodities,
            country1Name: t.country1.name,
            country2Name: t.country2.name,
            country1Slug: t.country1.slug,
            country2Slug: t.country2.slug,
          },
        });
      }

      const volumes = features.map((f) => f.properties.volume);
      return {
        type: "FeatureCollection" as const,
        features,
        metadata: {
          count: features.length,
          maxVolume: Math.max(0, ...volumes),
          minVolume: Math.min(Infinity, ...volumes),
        },
      };
    }),

  /**
   * 4.4 — Geopolitical Overlay: Alliance groups, diplomatic relations, and conflicts
   * as GeoJSON for network-style map visualization.
   */
  getGeopoliticalOverlay: cachedPublicProcedure.query(async ({ ctx }) => {
    // 1. Alliance groups
    const alliances = await ctx.db.alliance.findMany({
      where: { visibility: "public" },
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
      where: { id: { in: uniqueCountryIds } },
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
      where: { status: { in: ["active", "proposed", "accepted"] } },
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
