import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

export const diplomaticRouter = createTRPCRouter({
  // Get diplomatic relationships for a country
  getRelationships: publicProcedure
    .input(z.object({
      countryId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      // Mock diplomatic relations for now since table might not exist
      const mockRelations = [
        {
          id: '1',
          targetCountry: 'Allied Nation',
          targetCountryId: 'ally_1',
          relationship: 'alliance',
          strength: 85,
          treaties: ['Trade Agreement', 'Defense Pact'],
          lastContact: new Date().toISOString(),
          status: 'active',
          diplomaticChannels: ['Embassy', 'Trade Mission'],
          tradeVolume: 1500000000,
          culturalExchange: 'High'
        },
        {
          id: '2',
          targetCountry: 'Neutral State',
          targetCountryId: 'neutral_1',
          relationship: 'neutral',
          strength: 50,
          treaties: ['Non-Aggression Pact'],
          lastContact: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'active',
          diplomaticChannels: ['Embassy'],
          tradeVolume: 800000000,
          culturalExchange: 'Medium'
        }
      ];

      return mockRelations;
    }),

  // Get recent diplomatic changes
  getRecentChanges: publicProcedure
    .input(z.object({
      countryId: z.string(),
      hours: z.number().optional().default(24)
    }))
    .query(async ({ ctx, input }) => {
      // Mock recent diplomatic changes
      const mockChanges = [
        {
          id: '1',
          targetCountry: 'Strategic Partner',
          currentStatus: 'alliance',
          previousStatus: 'neutral',
          updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          changeType: 'status_upgrade'
        },
        {
          id: '2',
          targetCountry: 'Regional Rival',
          currentStatus: 'tension',
          previousStatus: 'neutral',
          updatedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          changeType: 'status_downgrade'
        }
      ];

      return mockChanges;
    }),

  // Update diplomatic relationship
  updateRelationship: publicProcedure
    .input(z.object({
      relationId: z.string(),
      relationship: z.string().optional(),
      strength: z.number().optional(),
      status: z.string().optional(),
      treaties: z.array(z.string()).optional(),
      diplomaticChannels: z.array(z.string()).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const updateData: any = {};

      if (input.relationship) updateData.relationship = input.relationship;
      if (input.strength !== undefined) updateData.strength = input.strength;
      if (input.status) updateData.status = input.status;
      if (input.treaties) updateData.treaties = JSON.stringify(input.treaties);
      if (input.diplomaticChannels) updateData.diplomaticChannels = JSON.stringify(input.diplomaticChannels);

      return await ctx.db.diplomaticRelation.update({
        where: { id: input.relationId },
        data: updateData
      });
    })
});