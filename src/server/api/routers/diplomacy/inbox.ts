import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { CountryEventSpine } from "~/lib/country-event-spine";

export const diplomaticInboxRouter = createTRPCRouter({
  getInbox: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Fetch pending diplomatic actions proposed by NPCs or other countries
      const actions = await ctx.db.diplomaticAction.findMany({
        where: {
          toCountryId: input.countryId,
          status: "pending",
        },
        orderBy: { createdAt: "desc" },
      });

      // Map actions and attach sender country details
      const resolvedActions = await Promise.all(
        actions.map(async (action) => {
          const fromCountry = await ctx.db.country.findUnique({
            where: { id: action.fromCountryId },
            select: { name: true, flag: true },
          });

          return {
            id: action.id,
            fromCountryId: action.fromCountryId,
            fromCountryName: fromCountry?.name ?? "Foreign State",
            fromCountryFlag: fromCountry?.flag ?? null,
            actionType: action.actionType,
            description: action.description,
            createdAt: action.createdAt,
          };
        })
      );

      return resolvedActions;
    }),

  respondToProposal: protectedProcedure
    .input(
      z.object({
        proposalId: z.string(),
        choice: z.enum(["accept", "reject"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { proposalId, choice } = input;

      const action = await ctx.db.diplomaticAction.findUnique({
        where: { id: proposalId },
      });

      if (!action) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Proposal not found",
        });
      }

      if (action.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Proposal is no longer pending",
        });
      }

      const updatedStatus = choice === "accept" ? "accepted" : "rejected";

      // Start database updates
      const result = await ctx.db.$transaction(async (tx) => {
        // Update proposal action status
        const updatedAction = await tx.diplomaticAction.update({
          where: { id: proposalId },
          data: { status: updatedStatus },
        });

        if (choice === "accept") {
          // Apply consequences based on actionType
          if (updatedAction.actionType === "relationship_change") {
            // E.g., upgrade relation strength
            const currentRelation = await tx.diplomaticRelation.findFirst({
              where: {
                OR: [
                  { country1: updatedAction.fromCountryId, country2: updatedAction.toCountryId },
                  { country1: updatedAction.toCountryId, country2: updatedAction.fromCountryId },
                ],
              },
            });

            if (currentRelation) {
              await tx.diplomaticRelation.update({
                where: { id: currentRelation.id },
                data: {
                  strength: Math.min(100, currentRelation.strength + 15),
                  status: "friendly",
                  lastContact: new Date(),
                },
              });
            } else {
              // Create relation
              await tx.diplomaticRelation.create({
                data: {
                  country1: updatedAction.fromCountryId,
                  country2: updatedAction.toCountryId,
                  relationship: "friendly",
                  strength: 60,
                  status: "friendly",
                  lastContact: new Date(),
                },
              });
            }

            // Log event via spine
            await CountryEventSpine.recordCountryEvent({
              db: tx as any,
              countryId: updatedAction.toCountryId,
              sourceType: "diplomacy",
              sourceId: updatedAction.id,
              description: `Accepted relationship upgrade proposal from partner country`,
              consequences: [
                {
                  targetModel: "Country",
                  targetField: "diplomaticStanding",
                  operation: "add",
                  value: 5.0,
                },
              ],
              newsTemplate: "embassy_established", // Use any appropriate templates
            });
          } else if (updatedAction.actionType === "treaty_proposal") {
            // Create a treaty
            await tx.treaty.create({
              data: {
                name: updatedAction.description || "Bilateral Agreement",
                parties: JSON.stringify([updatedAction.fromCountryId, updatedAction.toCountryId]),
                type: "bilateral",
                status: "active",
                signedDate: new Date(),
                expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
              },
            });

            // Log event via spine
            await CountryEventSpine.recordCountryEvent({
              db: tx as any,
              countryId: updatedAction.toCountryId,
              sourceType: "diplomacy",
              sourceId: updatedAction.id,
              description: `Signed treaty: ${updatedAction.description || "Bilateral Agreement"}`,
              consequences: [
                {
                  targetModel: "Country",
                  targetField: "tradeBalance",
                  operation: "add",
                  value: 2000000.0, // Economic boost from treaty
                },
              ],
            });
          } else if (updatedAction.actionType === "embassy_upgrade") {
            // Find existing embassy
            const embassy = await tx.embassy.findFirst({
              where: {
                OR: [
                  { hostCountryId: updatedAction.fromCountryId, guestCountryId: updatedAction.toCountryId },
                  { hostCountryId: updatedAction.toCountryId, guestCountryId: updatedAction.fromCountryId },
                ],
              },
            });

            if (embassy) {
              await tx.embassy.update({
                where: { id: embassy.id },
                data: {
                  level: { increment: 1 },
                  experience: 0,
                  status: "active",
                },
              });

              // Log event via spine
              await CountryEventSpine.recordCountryEvent({
                db: tx as any,
                countryId: updatedAction.toCountryId,
                sourceType: "diplomacy",
                sourceId: updatedAction.id,
                description: `Upgraded embassy level with strategic partner`,
                consequences: [
                  {
                    targetModel: "Country",
                    targetField: "governmentalEfficiency",
                    operation: "add",
                    value: 2.0,
                  },
                ],
              });
            }
          }
        } else {
          // Reject proposal logs
          await CountryEventSpine.recordCountryEvent({
            db: tx as any,
            countryId: updatedAction.toCountryId,
            sourceType: "diplomacy",
            sourceId: updatedAction.id,
            description: `Declined diplomatic proposal of type: ${updatedAction.actionType}`,
            consequences: [
              {
                targetModel: "Country",
                targetField: "diplomaticStanding",
                operation: "subtract",
                value: 2.0, // Slight diplomatic penalty for decline
              },
            ],
          });
        }

        return updatedAction;
      });

      return {
        success: true,
        action: result,
      };
    }),
});
