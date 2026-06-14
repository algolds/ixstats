import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

// Helper functions for cultural exchange <-> embassy mission integration
export const diplomaticCoreSharedDataRouter = createTRPCRouter({
  // Embassy Shared Data System
  getSharedData: publicProcedure
    .input(
      z.object({
        embassyId: z.string(),
        dataType: z.enum(["economic", "intelligence", "research", "cultural", "policy"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Fetch embassy to verify it exists and get country IDs
        const embassy = await ctx.db.embassy.findUnique({
          where: { id: input.embassyId },
          include: {
            hostCountry: { select: { id: true, name: true } },
            guestCountry: { select: { id: true, name: true } },
          },
        });

        if (!embassy) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Embassy not found" });
        }

        // Generate mock shared data based on embassy level and influence
        // In production, this would fetch from a SharedData table
        const embassyLevel = embassy.level || 1;
        const embassyInfluence = embassy.influence || 10;
        const embassyAge = Math.floor(
          (Date.now() - embassy.establishedAt.getTime()) / (1000 * 60 * 60 * 24)
        ); // Days since established

        const sharedData: any = {};

        // Economic Data
        if (!input.dataType || input.dataType === "economic") {
          // Query real diplomatic relation for trade volume
          const relation = await ctx.db.diplomaticRelation.findFirst({
            where: {
              OR: [
                { country1: embassy.hostCountryId, country2: embassy.guestCountryId },
                { country1: embassy.guestCountryId, country2: embassy.hostCountryId },
              ],
            },
          });

          // Get completed trade negotiation missions (joint ventures)
          const completedTradeMissions = await ctx.db.embassyMission.findMany({
            where: {
              embassyId: input.embassyId,
              type: "trade_negotiation",
              status: "completed",
            },
          });

          // Get active trade treaties between these countries
          const activeTradeTreaties = await ctx.db.treaty.findMany({
            where: {
              OR: [
                { parties: { contains: embassy.hostCountryId } },
                { parties: { contains: embassy.guestCountryId } },
              ],
              type: { contains: "trade" },
              status: "ratified",
            },
          });

          // Calculate real tradeVolume (from relation or calculate from embassy data)
          const baseTradeVolume = relation?.tradeVolume || 0;
          const missionTradeBonus = completedTradeMissions.reduce(
            (sum, mission) => sum + (mission.economicReward || 0),
            0
          );
          const tradeVolume = Math.floor(baseTradeVolume + missionTradeBonus);

          // Calculate tradeGrowth based on historical data if available
          let tradeGrowth = 0;
          try {
            // Get historical data for both countries to estimate trade growth
            const historicalData = await ctx.db.historicalDataPoint.findMany({
              where: {
                OR: [{ countryId: embassy.hostCountryId }, { countryId: embassy.guestCountryId }],
                ixTimeTimestamp: {
                  gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
                },
              },
              orderBy: { ixTimeTimestamp: "asc" },
              take: 20,
            });

            if (historicalData.length >= 2) {
              // Calculate average GDP growth between the two countries
              const avgGdpGrowth =
                historicalData.reduce((sum, point) => sum + point.gdpGrowthRate, 0) /
                historicalData.length;
              tradeGrowth = Math.floor(avgGdpGrowth * 0.5 + embassyLevel * 2.5); // Trade grows at ~50% of GDP growth + embassy bonus
            } else {
              // Fallback to embassy-based calculation
              tradeGrowth = Math.floor(embassyLevel * 2.5 + embassyInfluence * 0.3);
            }
          } catch (_error) {
            // Fallback calculation if historical data query fails
            tradeGrowth = Math.floor(embassyLevel * 2.5 + embassyInfluence * 0.3);
          }

          // Real jointVentures count (completed trade negotiation missions)
          const jointVentures = completedTradeMissions.length;

          // Calculate investmentValue based on real embassy data
          const investmentValue = Math.floor(
            (embassy.budget || 0) * 0.1 + // 10% of embassy budget
              completedTradeMissions.reduce((sum, m) => sum + (m.economicReward || 0), 0) * 0.5 + // 50% of mission rewards
              embassyLevel * embassyInfluence * 3 // Base calculation from embassy stats
          );

          // Calculate tariffsReduced from active trade treaties and embassy level
          const treatyTariffReduction = activeTradeTreaties.reduce((sum, treaty) => {
            return sum + (treaty.complianceRate || 0) * 0.15; // Each treaty contributes up to 15% based on compliance
          }, 0);
          const embassyTariffReduction = Math.floor(embassyLevel * 15 + embassyInfluence / 2);
          const tariffsReduced = Math.min(100, treatyTariffReduction + embassyTariffReduction);

          // Calculate economicBenefit from real data
          const economicBenefit = Math.min(
            50,
            embassyLevel * 3.5 +
              embassyInfluence / 10 +
              (tradeVolume > 0 ? Math.log10(tradeVolume + 1) * 2 : 0) + // Logarithmic bonus from trade volume
              jointVentures * 0.5 // Bonus from joint ventures
          );

          sharedData.economic = {
            tradeVolume,
            tradeGrowth,
            jointVentures,
            investmentValue,
            tariffsReduced: Math.floor(tariffsReduced),
            economicBenefit: Math.floor(economicBenefit * 10) / 10, // Round to 1 decimal
          };
        }

        // Intelligence Data
        // Fetch templates from database and generate reports based on embassy level
        if (!input.dataType || input.dataType === "intelligence") {
          const intelligenceReports: Array<{
            reportType: string;
            classification: string;
            summary: string;
            keyFindings: string[];
            confidence: number;
            lastUpdated: string;
          }> = [];

          // Calculate deterministic lastUpdated date based on embassy age
          // Reports are "updated" every 7 days, with the most recent being within the last week
          const daysSinceEstablishment = embassyAge;
          const reportCycle = 7; // 7-day reporting cycle
          const daysUntilNextReport = daysSinceEstablishment % reportCycle;
          const lastReportDate = new Date(Date.now() - daysUntilNextReport * 24 * 60 * 60 * 1000);

          // Fetch active intelligence templates from database
          const templates = await ctx.db.intelligenceTemplate.findMany({
            where: {
              isActive: true,
              minimumLevel: {
                lte: embassyLevel, // Only templates for which embassy qualifies
              },
            },
            orderBy: {
              minimumLevel: "asc",
            },
          });

          // Generate reports from templates
          templates.forEach((template, index) => {
            // Parse findings from JSON
            const keyFindings = JSON.parse(template.findingsTemplate) as string[];

            // Calculate confidence based on template base + embassy level
            // Economic: base 70 + level*5 (range: 75-90)
            // Political: base 75 + level*4 (range: 83-95)
            // Security: base 80 + level*3 (range: 89-95)
            const confidenceMultiplier =
              template.reportType === "economic" ? 5 : template.reportType === "political" ? 4 : 3;
            const confidence = Math.floor(
              template.confidenceBase + embassyLevel * confidenceMultiplier
            );

            // Stagger report dates: economic is most recent, others are older
            const dayOffset = index; // 0 for first (economic), 1 for second (political), etc.
            const reportDate = new Date(lastReportDate.getTime() - dayOffset * 24 * 60 * 60 * 1000);

            intelligenceReports.push({
              reportType: template.reportType,
              classification: template.classification,
              summary: template.summaryTemplate,
              keyFindings,
              confidence,
              lastUpdated: reportDate.toISOString(),
            });
          });

          sharedData.intelligence = intelligenceReports;
        }

        // Research Data
        // Query real research collaboration missions from EmbassyMission table
        if (!input.dataType || input.dataType === "research") {
          // Fetch all research collaboration missions for this embassy
          const researchMissions = await ctx.db.embassyMission.findMany({
            where: {
              embassyId: input.embassyId,
              type: "research_collaboration",
            },
            orderBy: { startedAt: "desc" },
          });

          const researchProjects = [];

          // Map completed/active research missions to research projects
          const _completedResearchCount = researchMissions.filter(
            (m) => m.status === "completed"
          ).length;
          const _activeResearchCount = researchMissions.filter((m) => m.status === "active").length;

          // Calculate aggregated metrics from real mission data
          const totalPublications = researchMissions.reduce((sum, mission) => {
            // Completed missions contribute 2 publications each, active missions 1
            return sum + (mission.status === "completed" ? 2 : mission.status === "active" ? 1 : 0);
          }, 0);

          const totalPatents = researchMissions.reduce((sum, mission) => {
            // Only completed missions generate patents, 1 per mission
            return sum + (mission.status === "completed" ? 1 : 0);
          }, 0);

          // Create research projects based on embassy level and real mission data
          if (embassyLevel >= 2) {
            researchProjects.push({
              researchArea: "Clean Energy Technologies",
              collaborators: [embassy.hostCountry.name, embassy.guestCountry.name],
              progress: Math.min(100, Math.floor(embassyAge * 1.5 + embassyLevel * 10)), // Deterministic based on age/level
              breakthroughs: ["Solar panel efficiency improvement", "Battery storage optimization"],
              publications: Math.floor(
                totalPublications * 0.6 + (embassyLevel * 2 + embassyAge / 30)
              ), // 60% from missions, 40% from time
              patents: Math.floor(totalPatents * 0.5 + (embassyLevel + embassyAge / 60)), // 50% from missions, 50% from time
            });
          }

          if (embassyLevel >= 3) {
            researchProjects.push({
              researchArea: "Agricultural Innovation",
              collaborators: [embassy.hostCountry.name, embassy.guestCountry.name],
              progress: Math.min(100, Math.floor(embassyAge * 1.2 + embassyLevel * 8)), // Deterministic based on age/level
              breakthroughs: ["Drought-resistant crop varieties", "Precision farming techniques"],
              publications: Math.floor(
                totalPublications * 0.4 + (embassyLevel * 1.5 + embassyAge / 40)
              ), // 40% from missions, 60% from time
              patents: Math.floor(totalPatents * 0.5 + (embassyLevel * 0.5 + embassyAge / 80)), // 50% from missions, 50% from time
            });
          }

          sharedData.research = researchProjects;
        }

        // Cultural Data
        // Query real cultural exchanges and missions
        if (!input.dataType || input.dataType === "cultural") {
          // Fetch cultural exchange events involving either country
          const culturalExchanges = await ctx.db.culturalExchange.findMany({
            where: {
              OR: [
                { hostCountryId: embassy.hostCountryId },
                { hostCountryId: embassy.guestCountryId },
                {
                  participatingCountries: {
                    some: {
                      OR: [
                        { countryId: embassy.hostCountryId },
                        { countryId: embassy.guestCountryId },
                      ],
                    },
                  },
                },
              ],
            },
          });

          // Fetch cultural outreach missions for this embassy
          const culturalMissions = await ctx.db.embassyMission.findMany({
            where: {
              embassyId: input.embassyId,
              type: "cultural_outreach",
            },
          });

          // Calculate real metrics from database
          const completedExchanges = culturalExchanges.filter(
            (e) => e.status === "completed"
          ).length;
          const activeExchanges = culturalExchanges.filter((e) => e.status === "active").length;
          const completedCulturalMissions = culturalMissions.filter(
            (m) => m.status === "completed"
          ).length;

          // Calculate real cultural impact from exchanges
          const totalCulturalImpact = culturalExchanges.reduce((sum, exchange) => {
            return sum + (exchange.culturalImpact || 0);
          }, 0);
          const avgCulturalImpact =
            culturalExchanges.length > 0 ? totalCulturalImpact / culturalExchanges.length : 0;

          // Calculate real diplomatic value
          const totalDiplomaticValue = culturalExchanges.reduce((sum, exchange) => {
            return sum + (exchange.diplomaticValue || 0);
          }, 0);
          const avgDiplomaticValue =
            culturalExchanges.length > 0 ? totalDiplomaticValue / culturalExchanges.length : 0;

          sharedData.cultural = {
            exchangePrograms: completedExchanges + Math.floor(embassyLevel * 2 + embassyAge / 30), // Real + deterministic
            culturalEvents:
              activeExchanges +
              completedExchanges +
              completedCulturalMissions +
              Math.floor(embassyLevel * 3 + embassyAge / 15), // Real + deterministic
            artistsExchanged: Math.floor(
              completedExchanges * 3 + embassyLevel * 4 + embassyAge / 20
            ), // Based on real exchanges + deterministic
            studentsExchanged: Math.floor(
              completedExchanges * 8 + embassyLevel * 10 + embassyAge / 10
            ), // Based on real exchanges + deterministic
            culturalImpactScore: Math.min(
              100,
              Math.floor(avgCulturalImpact + embassyLevel * 12 + embassyInfluence + embassyAge / 5)
            ), // Real impact + deterministic
            diplomaticGoodwill: Math.min(
              100,
              Math.floor(avgDiplomaticValue + embassyLevel * 15 + embassyInfluence * 0.8)
            ), // Real value + deterministic
          };
        }

        // Policy Data
        // Query real treaties between the two countries
        if (!input.dataType || input.dataType === "policy") {
          // Fetch treaties where both countries are parties
          // Note: Treaty.parties is a nullable string field, likely JSON or comma-separated
          const allTreaties = await ctx.db.treaty.findMany({
            where: {
              OR: [
                {
                  AND: [
                    { parties: { contains: embassy.hostCountryId } },
                    { parties: { contains: embassy.guestCountryId } },
                  ],
                },
                {
                  AND: [
                    { parties: { contains: embassy.hostCountry.name } },
                    { parties: { contains: embassy.guestCountry.name } },
                  ],
                },
              ],
            },
          });

          // Filter to only ratified treaties (status should be 'ratified' or 'active')
          const activeTreaties = allTreaties.filter(
            (t) =>
              t.status === "ratified" ||
              t.status === "active" ||
              t.status === "RATIFIED" ||
              t.status === "ACTIVE"
          );

          const policyFrameworks = activeTreaties.map((treaty) => {
            // Determine agreement type from treaty type
            let agreementType = "bilateral";
            if (treaty.type.toLowerCase().includes("framework")) {
              agreementType = "framework";
            } else if (
              treaty.type.toLowerCase().includes("memorandum") ||
              treaty.type.toLowerCase().includes("mou")
            ) {
              agreementType = "memorandum";
            }

            // Parse key provisions if stored in description
            const keyProvisions: string[] = [];
            if (treaty.description) {
              // Try to extract bullet points or numbered items from description
              const lines = treaty.description.split(/\n|;|\./).filter((l) => l.trim().length > 10);
              keyProvisions.push(...lines.slice(0, 3)); // Take first 3 meaningful lines
            }

            // If no provisions found, generate deterministic ones based on treaty type
            if (keyProvisions.length === 0) {
              if (treaty.type.toLowerCase().includes("trade")) {
                keyProvisions.push(
                  "Reduced tariffs on key exports",
                  "Streamlined customs procedures",
                  "Investment protection guarantees"
                );
              } else if (treaty.type.toLowerCase().includes("cultural")) {
                keyProvisions.push(
                  "Annual cultural festivals",
                  "Student exchange programs",
                  "Artist residency initiatives"
                );
              } else if (
                treaty.type.toLowerCase().includes("science") ||
                treaty.type.toLowerCase().includes("research")
              ) {
                keyProvisions.push(
                  "Joint research initiatives",
                  "Technology transfer agreements",
                  "Shared research facilities"
                );
              } else {
                keyProvisions.push(
                  "Mutual cooperation",
                  "Regular consultations",
                  "Information sharing"
                );
              }
            }

            return {
              policyFramework: treaty.name,
              agreementType,
              status: treaty.status.toLowerCase(),
              effectiveDate: treaty.signedDate.toISOString(),
              keyProvisions,
              compliance: treaty.complianceRate || Math.min(100, Math.floor(85 + embassyLevel * 3)), // Use real compliance or deterministic
            };
          });

          // If no real treaties exist, generate deterministic fallback treaties based on embassy level
          if (policyFrameworks.length === 0) {
            if (embassyLevel >= 1) {
              policyFrameworks.push({
                policyFramework: "Bilateral Trade Agreement",
                agreementType: "bilateral",
                status: "ratified",
                effectiveDate: new Date(
                  embassy.establishedAt.getTime() + 30 * 24 * 60 * 60 * 1000
                ).toISOString(),
                keyProvisions: [
                  "Reduced tariffs on key exports",
                  "Streamlined customs procedures",
                  "Investment protection guarantees",
                ],
                compliance: Math.min(100, Math.floor(85 + embassyLevel * 3)),
              });
            }

            if (embassyLevel >= 2) {
              policyFrameworks.push({
                policyFramework: "Cultural Exchange Framework",
                agreementType: "framework",
                status: "ratified",
                effectiveDate: new Date(
                  embassy.establishedAt.getTime() + 60 * 24 * 60 * 60 * 1000
                ).toISOString(),
                keyProvisions: [
                  "Annual cultural festivals",
                  "Student exchange programs",
                  "Artist residency initiatives",
                ],
                compliance: Math.min(100, Math.floor(80 + embassyLevel * 2.5)),
              });
            }

            if (embassyLevel >= 3) {
              policyFrameworks.push({
                policyFramework: "Science and Technology Cooperation",
                agreementType: "memorandum",
                status: embassyAge > 90 ? "ratified" : "under_review",
                effectiveDate:
                  embassyAge > 90
                    ? new Date(
                        embassy.establishedAt.getTime() + 90 * 24 * 60 * 60 * 1000
                      ).toISOString()
                    : "pending",
                keyProvisions: [
                  "Joint research initiatives",
                  "Technology transfer agreements",
                  "Shared research facilities",
                ],
                compliance: embassyAge > 90 ? Math.min(100, Math.floor(75 + embassyLevel * 2)) : 0,
              });
            }
          }

          sharedData.policy = policyFrameworks;
        }

        return sharedData;
      } catch (error) {
        console.error("Error fetching shared data:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch shared data",
          cause: error,
        });
      }
    }),

  shareData: protectedProcedure
    .input(
      z.object({
        embassyId: z.string(),
        dataType: z.enum(["economic", "intelligence", "research", "cultural", "policy"]),
        dataContent: z.object({
          title: z.string(),
          content: z.string(),
          metadata: z.record(z.string(), z.any()).optional(),
          expiresAt: z.string().optional(),
        }),
        shareLevel: z.enum(["view", "collaborate"]).default("view"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.countryId) {
        throw new Error("You must be associated with a country to share data.");
      }

      // Verify user owns the embassy (guestCountryId)
      const embassy = await ctx.db.embassy.findUnique({
        where: { id: input.embassyId },
      });

      if (!embassy || embassy.guestCountryId !== ctx.user.countryId) {
        throw new Error("You can only share data from your own embassies.");
      }

      // In production, this would create a SharedData record
      // For now, return success with mock data
      return {
        success: true,
        message: `${input.dataContent.title} has been shared with ${embassy.hostCountryId}`,
        dataType: input.dataType,
        shareLevel: input.shareLevel,
      };
    }),

  revokeSharedData: protectedProcedure
    .input(
      z.object({
        sharedDataId: z.string(),
      })
    )
    .mutation(async ({ ctx, input: _input }) => {
      if (!ctx.user?.countryId) {
        throw new Error("You must be associated with a country to revoke shared data.");
      }

      // In production, this would delete from SharedData table after verifying ownership
      return {
        success: true,
        message: "Data sharing has been revoked",
      };
    }),
});
