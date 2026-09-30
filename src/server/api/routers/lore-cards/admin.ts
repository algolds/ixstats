/**
 * Lore Cards tRPC Router
 *
 * Handles user-requested lore card generation from wiki articles
 * - Users pay 50 IxC to request specific wiki articles become lore cards
 * - Admins review and approve/reject requests
 * - System generates approved cards using wiki-lore-card-generator
 *
 * Features:
 * - User request submission with IxCredits payment
 * - Admin approval queue and review
 * - Automatic card generation on approval
 * - Request history and status tracking
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { wikiLoreCardGenerator } from "~/lib/wiki-os/adapters/ixstates/lore-card-generator";
import type { WikiSource } from "~/lib/wiki-os/config";
import { LedgerError, earnCreditsTx } from "~/lib/vault/vault-ledger";
import type { Prisma } from "@prisma/client";

const LORE_CARD_REQUEST_COST = 50; // IxCredits

/**
 * What the user actually paid for a lore request: read back the LORE_CARD_REQUEST
 * transaction (matched by requestId, or by article for requests filed before requestId was
 * recorded). Falls back to the flat request cost when no record is found.
 */
async function findLoreRequestPayment(
  tx: Prisma.TransactionClient,
  request: { id: string; userId: string; articleTitle: string; wikiSource: string }
): Promise<{ usedToken: boolean; credits: number }> {
  const vault = await tx.myVault.findUnique({ where: { userId: request.userId } });
  if (!vault) return { usedToken: false, credits: LORE_CARD_REQUEST_COST };

  const rows = await tx.vaultTransaction.findMany({
    where: { vaultId: vault.id, source: "LORE_CARD_REQUEST" },
    orderBy: { createdAt: "desc" },
    select: { credits: true, metadata: true },
  });

  for (const row of rows) {
    let meta: unknown = row.metadata;
    if (typeof meta === "string") {
      try {
        meta = JSON.parse(meta);
      } catch {
        continue;
      }
    }
    if (!meta || typeof meta !== "object") continue;
    const m = meta as Record<string, unknown>;
    const matches =
      m.requestId === request.id ||
      (m.requestId === undefined &&
        m.articleTitle === request.articleTitle &&
        m.wikiSource === request.wikiSource);
    if (!matches || m.tokenRefund === true) continue;
    return m.useToken === true
      ? { usedToken: true, credits: 0 }
      : { usedToken: false, credits: Math.abs(row.credits) || LORE_CARD_REQUEST_COST };
  }
  return { usedToken: false, credits: LORE_CARD_REQUEST_COST };
}

export const loreCardsAdminRouter = createTRPCRouter({
  /**
   * Get pending lore card request queue (admin only)
   */
  getRequestQueue: adminProcedure
    .input(
      z
        .object({
          status: z.enum(["PENDING", "APPROVED", "REJECTED", "GENERATED"]).optional(),
          limit: z.number().int().min(1).max(100).optional().default(50),
          offset: z.number().int().min(0).optional().default(0),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      try {
        const where = input?.status ? { status: input.status } : {};

        const requests = await ctx.db.loreCardRequest.findMany({
          where,
          orderBy: { requestedAt: "desc" },
          take: input?.limit ?? 50,
          skip: input?.offset ?? 0,
        });

        const total = await ctx.db.loreCardRequest.count({
          where,
        });

        // Resolve requester display names
        const userIds = Array.from(new Set(requests.map((r) => r.userId)));

        const [users, verifications] = await Promise.all([
          ctx.db.user.findMany({
            where: {
              OR: [{ clerkUserId: { in: userIds } }, { id: { in: userIds } }],
            },
            select: { id: true, clerkUserId: true, countryId: true },
          }),
          ctx.db.nSVerification.findMany({
            where: {
              userId: { in: userIds },
              verified: true,
            },
            select: { userId: true, nationName: true },
          }),
        ]);

        const countryIds = users.map((u) => u.countryId).filter((id): id is string => Boolean(id));
        const countries =
          countryIds.length > 0
            ? await ctx.db.country.findMany({
                where: { id: { in: countryIds } },
                select: { id: true, name: true },
              })
            : [];

        const countryMap = new Map(countries.map((c) => [c.id, c.name]));
        const verificationMap = new Map(verifications.map((v) => [v.userId, v.nationName]));

        const userMap = new Map<string, string>();
        for (const u of users) {
          const nationName =
            (u.countryId ? countryMap.get(u.countryId) : null) ||
            verificationMap.get(u.id) ||
            verificationMap.get(u.clerkUserId);
          if (nationName) {
            userMap.set(u.clerkUserId, nationName);
            userMap.set(u.id, nationName);
          }
        }

        const enrichedRequests = requests.map((r) => {
          const resolvedName = userMap.get(r.userId) || verificationMap.get(r.userId);
          const shortId = r.userId.startsWith("user_")
            ? r.userId.slice(5, 12)
            : r.userId.slice(0, 8);
          return {
            ...r,
            requesterName: resolvedName ? resolvedName : `User (${shortId})`,
          };
        });

        return {
          requests: enrichedRequests,
          total,
        };
      } catch (error) {
        console.error("[Lore Cards] Error in getRequestQueue:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch lore card request queue",
        });
      }
    }),

  /**
   * Approve a lore card request (admin only)
   */
  approveRequest: adminProcedure
    .input(
      z.object({
        requestId: z.string().cuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const adminUserId = ctx.user?.id;
        if (!adminUserId) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Admin authentication required",
          });
        }

        const request = await ctx.db.loreCardRequest.findUnique({
          where: { id: input.requestId },
        });

        if (!request) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Request not found",
          });
        }

        if (request.status !== "PENDING") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Request is already ${request.status.toLowerCase()}`,
          });
        }

        // Update request status
        await ctx.db.loreCardRequest.update({
          where: { id: input.requestId },
          data: {
            status: "APPROVED",
            reviewedAt: new Date(),
            reviewedBy: adminUserId,
          },
        });

        console.log(`[Lore Cards] Admin ${adminUserId} approved request ${input.requestId}`);

        return {
          success: true,
          message: "Request approved. Generating lore card...",
        };
      } catch (error) {
        console.error("[Lore Cards] Error in approveRequest:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to approve request",
        });
      }
    }),

  /**
   * Reject a lore card request (admin only)
   */
  rejectRequest: adminProcedure
    .input(
      z.object({
        requestId: z.string().cuid(),
        reason: z.string().min(1).max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const adminUserId = ctx.user?.id;
        if (!adminUserId) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Admin authentication required",
          });
        }

        const request = await ctx.db.loreCardRequest.findUnique({
          where: { id: input.requestId },
        });

        if (!request) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Request not found",
          });
        }

        if (request.status !== "PENDING") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Request is already ${request.status.toLowerCase()}`,
          });
        }

        // Reject and refund atomically. The conditional update makes a double-click (or two
        // admins) refund once; the refund goes through the ledger and mirrors what was paid.
        const refund = await ctx.db.$transaction(async (tx) => {
          const { count } = await tx.loreCardRequest.updateMany({
            where: { id: input.requestId, status: "PENDING" },
            data: {
              status: "REJECTED",
              reviewedAt: new Date(),
              reviewedBy: adminUserId,
              rejectionReason: input.reason,
            },
          });
          if (count !== 1) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Request is no longer pending",
            });
          }

          const paid = await findLoreRequestPayment(tx, request);
          const metadata = {
            requestId: request.id,
            articleTitle: request.articleTitle,
            reason: "Lore card request rejected",
          };

          if (paid.usedToken) {
            // Paid with a token: give the token back, not 50 IxC
            const vault = await tx.myVault.findUnique({ where: { userId: request.userId } });
            if (vault) {
              await tx.vaultTransaction.create({
                data: {
                  vaultId: vault.id,
                  credits: 0,
                  balanceAfter: vault.credits,
                  type: "REFUND",
                  source: "LORE_CARD_REQUEST",
                  metadata: { ...metadata, tokenRefund: true },
                },
              });
            }
            return { credits: 0, tokenRefunded: true };
          }

          await earnCreditsTx(tx, {
            userId: request.userId,
            amount: paid.credits,
            type: "REFUND",
            source: "LORE_CARD_REFUND",
            metadata,
          });
          return { credits: paid.credits, tokenRefunded: false };
        });

        console.log(
          `[Lore Cards] Admin ${adminUserId} rejected request ${input.requestId}. User refunded ${refund.tokenRefunded ? "1 token" : `${refund.credits} IxC`}`
        );

        return {
          success: true,
          message: "Request rejected and user refunded",
        };
      } catch (error) {
        console.error("[Lore Cards] Error in rejectRequest:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        if (error instanceof LedgerError) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: error.message });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to reject request",
        });
      }
    }),

  /**
   * Generate lore card from approved request (admin only)
   */
  generateRequestedCard: adminProcedure
    .input(
      z.object({
        requestId: z.string().cuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const adminUserId = ctx.user?.id;
        if (!adminUserId) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Admin authentication required",
          });
        }

        const request = await ctx.db.loreCardRequest.findUnique({
          where: { id: input.requestId },
        });

        if (!request) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Request not found",
          });
        }

        if (request.status !== "APPROVED") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Request must be approved before generating card",
          });
        }

        // Generate lore card (require image for production cards)
        const candidate = await wikiLoreCardGenerator.generateCard(
          request.articleTitle,
          request.wikiSource as WikiSource,
          { requireImage: true }
        );

        if (!candidate) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Failed to generate card. Article may not exist or quality may be too low.",
          });
        }

        // Create card in database
        const cardId = await wikiLoreCardGenerator.createCard(candidate);

        // Update request status
        await ctx.db.loreCardRequest.update({
          where: { id: input.requestId },
          data: {
            status: "GENERATED",
            cardId,
            generatedAt: new Date(),
          },
        });

        console.log(
          `[Lore Cards] Admin ${adminUserId} generated card ${cardId} from request ${input.requestId}`
        );

        return {
          success: true,
          cardId,
          card: candidate,
          message: "Lore card generated successfully",
        };
      } catch (error) {
        console.error("[Lore Cards] Error in generateRequestedCard:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate lore card",
        });
      }
    }),

  /**
   * Get statistics about lore card requests (admin only)
   */
  getRequestStats: adminProcedure.query(async ({ ctx }) => {
    try {
      const [total, pending, approved, rejected, generated] = await Promise.all([
        ctx.db.loreCardRequest.count(),
        ctx.db.loreCardRequest.count({ where: { status: "PENDING" } }),
        ctx.db.loreCardRequest.count({ where: { status: "APPROVED" } }),
        ctx.db.loreCardRequest.count({ where: { status: "REJECTED" } }),
        ctx.db.loreCardRequest.count({ where: { status: "GENERATED" } }),
      ]);

      return {
        total,
        pending,
        approved,
        rejected,
        generated,
      };
    } catch (error) {
      console.error("[Lore Cards] Error in getRequestStats:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch lore card request statistics",
      });
    }
  }),
});
