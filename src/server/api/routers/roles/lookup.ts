import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
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
// eslint-disable-next-line unused-imports/no-unused-vars
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
// eslint-disable-next-line unused-imports/no-unused-vars
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

export const rolesLookupRouter = createTRPCRouter({
  // Get all roles
  getRoles: publicProcedure.query(async ({ ctx }) => {
    try {
      const roles = await ctx.db.role.findMany({
        where: { isActive: true },
        include: {
          _count: {
            select: { users: true, rolePermissions: true },
          },
          rolePermissions: {
            include: {
              permission: true,
            },
          },
        },
        orderBy: { level: "asc" },
      });

      return roles.map((role) => ({
        ...role,
        userCount: role._count.users,
        permissionCount: role._count.rolePermissions,
        permissions: role.rolePermissions.map((rp) => rp.permission),
      }));
    } catch (error) {
      console.error("Failed to get roles:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to retrieve roles",
      });
    }
  }),

  // Get all permissions
  getPermissions: publicProcedure.query(async ({ ctx }) => {
    try {
      const permissions = await ctx.db.permission.findMany({
        orderBy: [{ category: "asc" }, { name: "asc" }],
      });

      // Group by category
      const groupedPermissions = permissions.reduce(
        (acc, permission) => {
          if (!acc[permission.category]) {
            acc[permission.category] = [];
          }
          acc[permission.category].push(permission);
          return acc;
        },
        {} as Record<string, typeof permissions>
      );

      return groupedPermissions;
    } catch (error) {
      console.error("Failed to get permissions:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to retrieve permissions",
      });
    }
  }),

  // Create a new role

  // Update a role

  // Delete a role

  // Assign role to user

  // Remove role from user

  // Get users with their roles

  // Get audit logs

  // Initialize default roles and permissions
});
