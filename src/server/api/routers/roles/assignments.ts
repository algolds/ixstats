import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

// Permission categories enum
export const PERMISSION_CATEGORIES = {
  SYSTEM: "system",
  USER: "user",
  CONTENT: "content",
  MODERATION: "moderation",
  ANALYTICS: "analytics",
} as const;

// Default role levels
export const ROLE_LEVELS = {
  OWNER: 0,
  ADMIN: 10,
  STAFF: 20,
  MODERATOR: 30,
  USER: 100,
} as const;

// Helper function to check if user has permission
// oxlint-disable-next-line typescript/no-unused-vars
async function checkPermission(ctx: any, permission: string): Promise<boolean> {
  if (!ctx.auth?.userId || !ctx.user?.role) {
    return false;
  }

  // Check if user's role has the required permission
  const rolePermissions = await ctx.db.rolePermission.findMany({
    where: {
      roleId: ctx.user.role.id,
      permission: { name: permission },
    },
    include: { permission: true },
  });

  return rolePermissions.length > 0;
}

// Helper function to log actions
async function auditLog(
  ctx: any,
  action: string,
  target?: string,
  details?: any,
  success = true,
  error?: string
) {
  try {
    await ctx.db.auditLog.create({
      data: {
        userId: ctx.userId || null, // Will be populated when auth context is added
        action,
        target,
        details: details ? JSON.stringify(details) : null,
        success,
        error,
      },
    });
  } catch (logError) {
    console.error("Failed to create audit log:", logError);
  }
}

export const rolesAssignmentsRouter = createTRPCRouter({
  // Get all roles

  // Get all permissions

  // Create a new role

  // Update a role

  // Delete a role

  // Assign role to user
  assignUserRole: adminProcedure
    .input(
      z.object({
        clerkUserId: z.string(),
        roleId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify role exists
        const role = await ctx.db.role.findUnique({
          where: { id: input.roleId },
        });

        if (!role) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Role not found",
          });
        }

        // Update or create user record
        const user = await ctx.db.user.upsert({
          where: { clerkUserId: input.clerkUserId },
          update: { roleId: input.roleId },
          create: {
            clerkUserId: input.clerkUserId,
            roleId: input.roleId,
          },
        });

        await auditLog(ctx, "role.assign", user.id, {
          clerkUserId: input.clerkUserId,
          roleId: input.roleId,
          roleName: role.name,
        });

        return { success: true, userId: user.id };
      } catch (error) {
        await auditLog(
          ctx,
          "role.assign",
          undefined,
          input,
          false,
          error instanceof Error ? error.message : "Unknown error"
        );

        if (error instanceof TRPCError) throw error;
        console.error("Failed to assign role:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to assign role",
        });
      }
    }),

  // Remove role from user
  removeUserRole: adminProcedure
    .input(
      z.object({
        clerkUserId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const user = await ctx.db.user.findUnique({
          where: { clerkUserId: input.clerkUserId },
          include: { role: true },
        });

        if (!user) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User not found",
          });
        }

        await ctx.db.user.update({
          where: { clerkUserId: input.clerkUserId },
          data: { roleId: null },
        });

        await auditLog(ctx, "role.remove", user.id, {
          clerkUserId: input.clerkUserId,
          previousRole: user.role?.name,
        });

        return { success: true };
      } catch (error) {
        await auditLog(
          ctx,
          "role.remove",
          undefined,
          input,
          false,
          error instanceof Error ? error.message : "Unknown error"
        );

        if (error instanceof TRPCError) throw error;
        console.error("Failed to remove role:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to remove role",
        });
      }
    }),

  // Get users with their roles
  getUsersWithRoles: adminProcedure
    .input(
      z
        .object({
          page: z.number().min(1).default(1),
          limit: z.number().min(1).max(100).default(50),
          search: z.string().optional(),
          roleId: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input = {} }) => {
      try {
        const { page = 1, limit = 50, search, roleId } = input;
        const offset = (page - 1) * limit;

        const where: any = {};
        if (search) {
          where.clerkUserId = {
            contains: search,
            // Note: SQLite doesn't support mode: 'insensitive', search is case-sensitive
          };
        }
        if (roleId) {
          where.roleId = roleId;
        }

        const [users, total] = await Promise.all([
          ctx.db.user.findMany({
            where,
            include: {
              role: true,
              country: {
                select: { id: true, name: true },
              },
            },
            orderBy: { createdAt: "desc" },
            skip: offset,
            take: limit,
          }),
          ctx.db.user.count({ where }),
        ]);

        return {
          users,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        };
      } catch (error) {
        console.error("Failed to get users with roles:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve users",
        });
      }
    }),

  // Get audit logs
  getAuditLogs: adminProcedure
    .input(
      z
        .object({
          page: z.number().min(1).default(1),
          limit: z.number().min(1).max(100).default(50),
          action: z.string().optional(),
          userId: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input = {} }) => {
      try {
        const { page = 1, limit = 50, action, userId } = input;
        const offset = (page - 1) * limit;

        const where: any = {};
        if (action) where.action = action;
        if (userId) where.userId = userId;

        const [logs, total] = await Promise.all([
          ctx.db.auditLog.findMany({
            where,
            orderBy: { timestamp: "desc" },
            skip: offset,
            take: limit,
          }),
          ctx.db.auditLog.count({ where }),
        ]);

        return {
          logs,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        };
      } catch (error) {
        console.error("Failed to get audit logs:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve audit logs",
        });
      }
    }),

  // Initialize default roles and permissions
});
