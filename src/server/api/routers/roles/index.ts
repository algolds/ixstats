import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { isSystemOwner } from "~/lib/auth";
import { globalCache } from "~/lib/cache";
import type { PrismaClient } from "@prisma/client";

/** Lower level = more privilege. A non-owner may act only on levels strictly below (numerically above) their own. */
function assertOutranks(isOwner: boolean, callerLevel: number, targetLevel: number, what: string) {
  if (!isOwner && targetLevel <= callerLevel) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You can't change ${what} at or above your own rank`,
    });
  }
}

/** A non-owner may only hand out permissions their own role holds. */
async function assertGrantable(
  db: PrismaClient,
  isOwner: boolean,
  caller: { roleId?: string | null; role?: { id?: string; name: string } | null },
  permissionIds: string[]
) {
  if (isOwner || permissionIds.length === 0) return;

  let callerRoleId = caller.role?.id ?? caller.roleId ?? null;
  if (!callerRoleId && caller.role?.name) {
    const found = await db.role.findFirst({ where: { name: caller.role.name } });
    callerRoleId = found?.id ?? null;
  }

  const held = callerRoleId
    ? await db.rolePermission.findMany({
        where: { roleId: callerRoleId },
        select: { permissionId: true },
      })
    : [];
  const heldIds = new Set(held.map((rp) => rp.permissionId));
  if (permissionIds.some((id) => !heldIds.has(id))) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You can only grant permissions your own role has",
    });
  }
}

export const rolesRouter = createTRPCRouter({
  // Get all active roles with assigned permissions and user counts
  getRoles: adminProcedure.query(async ({ ctx }) => {
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
        id: role.id,
        name: role.name,
        displayName: role.displayName,
        description: role.description,
        level: role.level,
        isSystem: role.isSystem,
        isActive: role.isActive,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
        userCount: role._count.users,
        permissionCount: role._count.rolePermissions,
        permissions: role.rolePermissions.map((rp) => rp.permission),
      }));
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      console.error("Failed to get roles:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to retrieve roles",
      });
    }
  }),

  // Get all permissions grouped by category
  getPermissions: adminProcedure.query(async ({ ctx }) => {
    try {
      const permissions = await ctx.db.permission.findMany({
        orderBy: [{ category: "asc" }, { name: "asc" }],
      });

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
      if (error instanceof TRPCError) throw error;
      console.error("Failed to get permissions:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to retrieve permissions",
      });
    }
  }),

  // Create a new role
  createRole: adminProcedure
    .input(
      z.object({
        name: z
          .string()
          .min(1)
          .max(50)
          .regex(/^[a-z_]+$/, "Role name must be lowercase with underscores only"),
        displayName: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        level: z.number().int().min(0).max(1000),
        permissionIds: z.array(z.string()).max(200).optional().default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const callerUserId = ctx.user.clerkUserId;
      const isOwner = isSystemOwner(callerUserId) || ctx.user?.role?.level === 0;
      const callerLevel = ctx.user?.role?.level ?? 999;

      if (!isOwner && input.level < callerLevel) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot create a role with higher privileges than your own",
        });
      }

      await assertGrantable(ctx.db, isOwner, ctx.user, input.permissionIds);

      const existingName = await ctx.db.role.findUnique({
        where: { name: input.name },
      });
      if (existingName) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Role name '${input.name}' already exists`,
        });
      }

      const existingLevel = await ctx.db.role.findUnique({
        where: { level: input.level },
      });
      if (existingLevel) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Role level ${input.level} already exists`,
        });
      }

      const role = await ctx.db.$transaction(async (tx) => {
        const created = await tx.role.create({
          data: {
            name: input.name,
            displayName: input.displayName,
            description: input.description,
            level: input.level,
            isSystem: false,
            isActive: true,
          },
        });

        if (input.permissionIds.length > 0) {
          await tx.rolePermission.createMany({
            data: input.permissionIds.map((permissionId) => ({
              roleId: created.id,
              permissionId,
            })),
          });
        }

        return created;
      });

      await ctx.db.adminAuditLog.create({
        data: {
          action: "ROLE_CREATED",
          targetType: "role",
          targetId: role.id,
          targetName: role.name,
          changes: JSON.stringify({
            name: input.name,
            displayName: input.displayName,
            level: input.level,
            permissionsCount: input.permissionIds.length,
          }),
          adminId: ctx.user.id,
          adminName: ctx.user.clerkUserId,
          timestamp: new Date(),
        },
      });

      return { success: true, roleId: role.id };
    }),

  // Update a role
  updateRole: adminProcedure
    .input(
      z.object({
        roleId: z.string(),
        displayName: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional(),
        level: z.number().int().min(0).max(1000).optional(),
        permissionIds: z.array(z.string()).max(200).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const role = await ctx.db.role.findUnique({
        where: { id: input.roleId },
      });

      if (!role) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Role not found",
        });
      }

      const callerUserId = ctx.user.clerkUserId;
      const isOwner = isSystemOwner(callerUserId) || ctx.user?.role?.level === 0;
      const callerLevel = ctx.user?.role?.level ?? 999;

      if (role.name === "owner" && !isOwner) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot modify owner role",
        });
      }

      assertOutranks(isOwner, callerLevel, role.level, "a role");

      if (input.permissionIds !== undefined) {
        await assertGrantable(ctx.db, isOwner, ctx.user, input.permissionIds);
      }

      if (input.level !== undefined && input.level !== role.level) {
        if (!isOwner && input.level < callerLevel) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Cannot set a role level with higher privileges than your own",
          });
        }

        const conflict = await ctx.db.role.findFirst({
          where: {
            level: input.level,
            id: { not: input.roleId },
          },
        });
        if (conflict) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Role level ${input.level} is already taken by role '${conflict.name}'`,
          });
        }
      }

      await ctx.db.$transaction(async (tx) => {
        await tx.role.update({
          where: { id: input.roleId },
          data: {
            ...(input.displayName !== undefined && { displayName: input.displayName }),
            ...(input.description !== undefined && { description: input.description }),
            ...(input.level !== undefined && { level: input.level }),
            ...(input.isActive !== undefined && { isActive: input.isActive }),
          },
        });

        if (input.permissionIds !== undefined) {
          await tx.rolePermission.deleteMany({
            where: { roleId: input.roleId },
          });

          if (input.permissionIds.length > 0) {
            await tx.rolePermission.createMany({
              data: input.permissionIds.map((permissionId) => ({
                roleId: input.roleId,
                permissionId,
              })),
            });
          }
        }
      });

      await ctx.db.adminAuditLog.create({
        data: {
          action: "ROLE_UPDATED",
          targetType: "role",
          targetId: role.id,
          targetName: role.name,
          changes: JSON.stringify(input),
          adminId: ctx.user.id,
          adminName: ctx.user.clerkUserId,
          timestamp: new Date(),
        },
      });

      return { success: true };
    }),

  // Delete a non-system role
  deleteRole: adminProcedure
    .input(
      z.object({
        roleId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const role = await ctx.db.role.findUnique({
        where: { id: input.roleId },
      });

      if (!role) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Role not found",
        });
      }

      const callerIsOwner = isSystemOwner(ctx.user.clerkUserId) || ctx.user?.role?.level === 0;
      assertOutranks(callerIsOwner, ctx.user?.role?.level ?? 999, role.level, "a role");

      if (role.isSystem) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "System roles cannot be deleted",
        });
      }

      const userCount = await ctx.db.user.count({
        where: { roleId: role.id },
      });

      if (userCount > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot delete role '${role.displayName}' because it is assigned to active users. Reassign users first.`,
        });
      }

      await ctx.db.role.delete({
        where: { id: input.roleId },
      });

      await ctx.db.adminAuditLog.create({
        data: {
          action: "ROLE_DELETED",
          targetType: "role",
          targetId: role.id,
          targetName: role.name,
          changes: JSON.stringify({ roleName: role.name, level: role.level }),
          adminId: ctx.user.id,
          adminName: ctx.user.clerkUserId,
          timestamp: new Date(),
        },
      });

      return { success: true };
    }),

  // Assign or change a user's role
  assignUserRole: adminProcedure
    .input(
      z.object({
        clerkUserId: z.string().min(1),
        roleId: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const targetUser = await ctx.db.user.findUnique({
        where: { clerkUserId: input.clerkUserId },
        include: { role: true },
      });

      if (!targetUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `User '${input.clerkUserId}' not found`,
        });
      }

      const callerUserId = ctx.user.clerkUserId;
      const isOwner = isSystemOwner(callerUserId) || ctx.user?.role?.level === 0;
      const callerLevel = ctx.user?.role?.level ?? 999;

      if (!isOwner) {
        if (
          isSystemOwner(input.clerkUserId) ||
          targetUser.role?.level === 0 ||
          targetUser.role?.name === "owner"
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Cannot modify roles for system owners",
          });
        }

        if (targetUser.role) {
          assertOutranks(isOwner, callerLevel, targetUser.role.level, "a user");
        }
      }

      let targetRole: { id: string; name: string; level: number } | null = null;
      if (input.roleId) {
        targetRole = await ctx.db.role.findUnique({
          where: { id: input.roleId },
          select: { id: true, name: true, level: true },
        });

        if (!targetRole) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Target role not found",
          });
        }

        if (!isOwner && targetRole.level < callerLevel) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Cannot assign a role with higher privileges than your own",
          });
        }
      }

      await ctx.db.user.update({
        where: { clerkUserId: input.clerkUserId },
        data: { roleId: targetRole ? targetRole.id : null },
      });

      await globalCache.delete(`user_profile:${input.clerkUserId}`);

      await ctx.db.adminAuditLog.create({
        data: {
          action: "USER_ROLE_ASSIGNED",
          targetType: "user",
          targetId: targetUser.id,
          targetName: targetUser.clerkUserId,
          changes: JSON.stringify({
            previousRoleId: targetUser.roleId,
            newRoleId: targetRole?.id ?? null,
            newRoleName: targetRole?.name ?? null,
          }),
          adminId: ctx.user.id,
          adminName: ctx.user.clerkUserId,
          timestamp: new Date(),
        },
      });

      return { success: true };
    }),

  // Get users with their roles
  getUsersWithRoles: adminProcedure
    .input(
      z
        .object({
          page: z.number().int().min(1).default(1),
          limit: z.number().int().min(1).max(100).default(50),
          search: z.string().optional(),
          roleId: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input = {} }) => {
      const { page = 1, limit = 50, search, roleId } = input;
      const offset = (page - 1) * limit;

      const where: any = {};
      if (search) {
        where.OR = [
          { clerkUserId: { contains: search } },
          { country: { name: { contains: search } } },
        ];
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
        users: users.map((u) => ({
          id: u.id,
          clerkUserId: u.clerkUserId,
          membershipTier: u.membershipTier || "basic",
          country: u.country,
          role: u.role,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    }),
});
