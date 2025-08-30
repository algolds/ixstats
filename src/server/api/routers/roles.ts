import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

// Permission categories enum
export const PERMISSION_CATEGORIES = {
  SYSTEM: 'system',
  USER: 'user', 
  CONTENT: 'content',
  MODERATION: 'moderation',
  ANALYTICS: 'analytics'
} as const;

// Default role levels
export const ROLE_LEVELS = {
  OWNER: 0,
  ADMIN: 10,
  STAFF: 20,
  MODERATOR: 30,
  USER: 100
} as const;

// Helper function to check if user has permission (to be implemented later)
async function checkPermission(ctx: any, permission: string): Promise<boolean> {
  // TODO: Implement actual permission checking logic
  // For now, return true (will be implemented with auth context)
  return true;
}

// Helper function to log actions
async function auditLog(ctx: any, action: string, target?: string, details?: any, success = true, error?: string) {
  try {
    await ctx.db.auditLog.create({
      data: {
        userId: ctx.userId || null, // Will be populated when auth context is added
        action,
        target,
        details: details ? JSON.stringify(details) : null,
        success,
        error,
      }
    });
  } catch (logError) {
    console.error("Failed to create audit log:", logError);
  }
}

export const rolesRouter = createTRPCRouter({
  // Get all roles
  getRoles: publicProcedure
    .query(async ({ ctx }) => {
      try {
        const roles = await ctx.db.role.findMany({
          where: { isActive: true },
          include: {
            _count: {
              select: { users: true, rolePermissions: true }
            },
            rolePermissions: {
              include: {
                permission: true
              }
            }
          },
          orderBy: { level: 'asc' }
        });

        return roles.map(role => ({
          ...role,
          userCount: role._count.users,
          permissionCount: role._count.rolePermissions,
          permissions: role.rolePermissions.map(rp => rp.permission)
        }));
      } catch (error) {
        console.error("Failed to get roles:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve roles'
        });
      }
    }),

  // Get all permissions
  getPermissions: publicProcedure
    .query(async ({ ctx }) => {
      try {
        const permissions = await ctx.db.permission.findMany({
          orderBy: [
            { category: 'asc' },
            { name: 'asc' }
          ]
        });

        // Group by category
        const groupedPermissions = permissions.reduce((acc, permission) => {
          if (!acc[permission.category]) {
            acc[permission.category] = [];
          }
          acc[permission.category].push(permission);
          return acc;
        }, {} as Record<string, typeof permissions>);

        return groupedPermissions;
      } catch (error) {
        console.error("Failed to get permissions:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve permissions'
        });
      }
    }),

  // Create a new role
  createRole: publicProcedure
    .input(z.object({
      name: z.string().min(1).max(50).regex(/^[a-z_]+$/, "Role name must be lowercase with underscores only"),
      displayName: z.string().min(1).max(100),
      description: z.string().optional(),
      level: z.number().min(0).max(1000),
      permissionIds: z.array(z.string()).optional().default([])
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // TODO: Add permission check
        // if (!(await checkPermission(ctx, 'role.create'))) {
        //   throw new TRPCError({ code: 'FORBIDDEN', message: 'Insufficient permissions' });
        // }

        // Check if role name already exists
        const existingRole = await ctx.db.role.findUnique({
          where: { name: input.name }
        });

        if (existingRole) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Role name already exists'
          });
        }

        // Check if level is already taken
        const existingLevel = await ctx.db.role.findUnique({
          where: { level: input.level }
        });

        if (existingLevel) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Role level already exists'
          });
        }

        // Create role
        const role = await ctx.db.role.create({
          data: {
            name: input.name,
            displayName: input.displayName,
            description: input.description,
            level: input.level,
          }
        });

        // Add permissions if provided
        if (input.permissionIds.length > 0) {
          await ctx.db.rolePermission.createMany({
            data: input.permissionIds.map(permissionId => ({
              roleId: role.id,
              permissionId
            }))
          });
        }

        await auditLog(ctx, 'role.create', role.id, { 
          roleName: input.name, 
          permissionCount: input.permissionIds.length 
        });

        return { success: true, roleId: role.id };
      } catch (error) {
        await auditLog(ctx, 'role.create', undefined, input, false, 
          error instanceof Error ? error.message : 'Unknown error');
        
        if (error instanceof TRPCError) throw error;
        console.error("Failed to create role:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create role'
        });
      }
    }),

  // Update a role
  updateRole: publicProcedure
    .input(z.object({
      roleId: z.string(),
      displayName: z.string().min(1).max(100).optional(),
      description: z.string().optional(),
      level: z.number().min(0).max(1000).optional(),
      permissionIds: z.array(z.string()).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Check if role exists and is not a system role
        const existingRole = await ctx.db.role.findUnique({
          where: { id: input.roleId }
        });

        if (!existingRole) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Role not found'
          });
        }

        if (existingRole.isSystem) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Cannot modify system roles'
          });
        }

        // Check level conflicts if updating level
        if (input.level !== undefined && input.level !== existingRole.level) {
          const levelConflict = await ctx.db.role.findUnique({
            where: { level: input.level }
          });

          if (levelConflict) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Role level already exists'
            });
          }
        }

        // Update role
        const updateData: any = {};
        if (input.displayName !== undefined) updateData.displayName = input.displayName;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.level !== undefined) updateData.level = input.level;

        await ctx.db.role.update({
          where: { id: input.roleId },
          data: updateData
        });

        // Update permissions if provided
        if (input.permissionIds !== undefined) {
          // Remove existing permissions
          await ctx.db.rolePermission.deleteMany({
            where: { roleId: input.roleId }
          });

          // Add new permissions
          if (input.permissionIds.length > 0) {
            await ctx.db.rolePermission.createMany({
              data: input.permissionIds.map(permissionId => ({
                roleId: input.roleId,
                permissionId
              }))
            });
          }
        }

        await auditLog(ctx, 'role.update', input.roleId, input);

        return { success: true };
      } catch (error) {
        await auditLog(ctx, 'role.update', input.roleId, input, false,
          error instanceof Error ? error.message : 'Unknown error');
        
        if (error instanceof TRPCError) throw error;
        console.error("Failed to update role:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update role'
        });
      }
    }),

  // Delete a role
  deleteRole: publicProcedure
    .input(z.object({
      roleId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const role = await ctx.db.role.findUnique({
          where: { id: input.roleId },
          include: {
            _count: { select: { users: true } }
          }
        });

        if (!role) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Role not found'
          });
        }

        if (role.isSystem) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Cannot delete system roles'
          });
        }

        if (role._count.users > 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Cannot delete role with assigned users'
          });
        }

        await ctx.db.role.delete({
          where: { id: input.roleId }
        });

        await auditLog(ctx, 'role.delete', input.roleId, { roleName: role.name });

        return { success: true };
      } catch (error) {
        await auditLog(ctx, 'role.delete', input.roleId, undefined, false,
          error instanceof Error ? error.message : 'Unknown error');
        
        if (error instanceof TRPCError) throw error;
        console.error("Failed to delete role:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete role'
        });
      }
    }),

  // Assign role to user
  assignUserRole: publicProcedure
    .input(z.object({
      clerkUserId: z.string(),
      roleId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify role exists
        const role = await ctx.db.role.findUnique({
          where: { id: input.roleId }
        });

        if (!role) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Role not found'
          });
        }

        // Update or create user record
        const user = await ctx.db.user.upsert({
          where: { clerkUserId: input.clerkUserId },
          update: { roleId: input.roleId },
          create: { 
            clerkUserId: input.clerkUserId, 
            roleId: input.roleId 
          }
        });

        await auditLog(ctx, 'role.assign', user.id, {
          clerkUserId: input.clerkUserId,
          roleId: input.roleId,
          roleName: role.name
        });

        return { success: true, userId: user.id };
      } catch (error) {
        await auditLog(ctx, 'role.assign', undefined, input, false,
          error instanceof Error ? error.message : 'Unknown error');
        
        if (error instanceof TRPCError) throw error;
        console.error("Failed to assign role:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to assign role'
        });
      }
    }),

  // Remove role from user
  removeUserRole: publicProcedure
    .input(z.object({
      clerkUserId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const user = await ctx.db.user.findUnique({
          where: { clerkUserId: input.clerkUserId },
          include: { role: true }
        });

        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found'
          });
        }

        await ctx.db.user.update({
          where: { clerkUserId: input.clerkUserId },
          data: { roleId: null }
        });

        await auditLog(ctx, 'role.remove', user.id, {
          clerkUserId: input.clerkUserId,
          previousRole: user.role?.name
        });

        return { success: true };
      } catch (error) {
        await auditLog(ctx, 'role.remove', undefined, input, false,
          error instanceof Error ? error.message : 'Unknown error');
        
        if (error instanceof TRPCError) throw error;
        console.error("Failed to remove role:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to remove role'
        });
      }
    }),

  // Get users with their roles
  getUsersWithRoles: publicProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(50),
      search: z.string().optional(),
      roleId: z.string().optional()
    }).optional())
    .query(async ({ ctx, input = {} }) => {
      try {
        const { page = 1, limit = 50, search, roleId } = input;
        const offset = (page - 1) * limit;

        const where: any = {};
        if (search) {
          where.clerkUserId = {
            contains: search,
            mode: 'insensitive'
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
                select: { id: true, name: true }
              }
            },
            orderBy: { createdAt: 'desc' },
            skip: offset,
            take: limit
          }),
          ctx.db.user.count({ where })
        ]);

        return {
          users,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        };
      } catch (error) {
        console.error("Failed to get users with roles:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve users'
        });
      }
    }),

  // Get audit logs
  getAuditLogs: publicProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(50),
      action: z.string().optional(),
      userId: z.string().optional()
    }).optional())
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
            orderBy: { timestamp: 'desc' },
            skip: offset,
            take: limit
          }),
          ctx.db.auditLog.count({ where })
        ]);

        return {
          logs,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        };
      } catch (error) {
        console.error("Failed to get audit logs:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve audit logs'
        });
      }
    }),

  // Initialize default roles and permissions
  initializeRoleSystem: publicProcedure
    .mutation(async ({ ctx }) => {
      try {
        // Check if already initialized
        const existingRoles = await ctx.db.role.count();
        if (existingRoles > 0) {
          return { success: true, message: 'Role system already initialized' };
        }

        // Create default permissions
        const permissions = [
          // System permissions
          { name: 'system.config', displayName: 'System Configuration', category: 'system' },
          { name: 'system.maintenance', displayName: 'System Maintenance', category: 'system' },
          { name: 'system.logs', displayName: 'View System Logs', category: 'system' },
          
          // User management permissions
          { name: 'user.view', displayName: 'View Users', category: 'user' },
          { name: 'user.manage', displayName: 'Manage Users', category: 'user' },
          { name: 'user.ban', displayName: 'Ban Users', category: 'user' },
          { name: 'user.delete', displayName: 'Delete Users', category: 'user' },
          
          // Content permissions
          { name: 'content.view', displayName: 'View All Content', category: 'content' },
          { name: 'content.edit', displayName: 'Edit Content', category: 'content' },
          { name: 'content.delete', displayName: 'Delete Content', category: 'content' },
          { name: 'content.publish', displayName: 'Publish Content', category: 'content' },
          
          // Moderation permissions
          { name: 'moderation.reports', displayName: 'View Reports', category: 'moderation' },
          { name: 'moderation.actions', displayName: 'Moderation Actions', category: 'moderation' },
          
          // Analytics permissions
          { name: 'analytics.view', displayName: 'View Analytics', category: 'analytics' },
          { name: 'analytics.export', displayName: 'Export Analytics', category: 'analytics' },
          
          // Role management permissions
          { name: 'role.view', displayName: 'View Roles', category: 'user' },
          { name: 'role.create', displayName: 'Create Roles', category: 'user' },
          { name: 'role.edit', displayName: 'Edit Roles', category: 'user' },
          { name: 'role.delete', displayName: 'Delete Roles', category: 'user' },
          { name: 'role.assign', displayName: 'Assign Roles', category: 'user' },
        ];

        const createdPermissions = await Promise.all(
          permissions.map(p => ctx.db.permission.create({
            data: { ...p, isSystem: true }
          }))
        );

        const permissionMap = Object.fromEntries(
          createdPermissions.map(p => [p.name, p.id])
        );

        // Create default roles
        const roles = [
          {
            name: 'owner',
            displayName: 'System Owner',
            description: 'Full system access with all permissions',
            level: ROLE_LEVELS.OWNER,
            permissions: Object.values(permissionMap) // All permissions
          },
          {
            name: 'admin',
            displayName: 'Administrator',
            description: 'Administrative access with most permissions',
            level: ROLE_LEVELS.ADMIN,
            permissions: Object.values(permissionMap).filter(id => {
              const perm = createdPermissions.find(p => p.id === id);
              return perm?.category !== 'system' || perm.name === 'system.logs';
            })
          },
          {
            name: 'staff',
            displayName: 'Staff Member',
            description: 'Content management and user support',
            level: ROLE_LEVELS.STAFF,
            permissions: [
              permissionMap['user.view'],
              permissionMap['user.manage'],
              permissionMap['content.view'],
              permissionMap['content.edit'],
              permissionMap['content.publish'],
              permissionMap['moderation.reports'],
              permissionMap['analytics.view']
            ]
          },
          {
            name: 'moderator',
            displayName: 'Moderator',
            description: 'Content moderation and user oversight',
            level: ROLE_LEVELS.MODERATOR,
            permissions: [
              permissionMap['user.view'],
              permissionMap['user.ban'],
              permissionMap['content.view'],
              permissionMap['content.edit'],
              permissionMap['content.delete'],
              permissionMap['moderation.reports'],
              permissionMap['moderation.actions']
            ]
          },
          {
            name: 'user',
            displayName: 'Standard User',
            description: 'Basic user permissions',
            level: ROLE_LEVELS.USER,
            permissions: []
          }
        ];

        for (const roleData of roles) {
          const role = await ctx.db.role.create({
            data: {
              name: roleData.name,
              displayName: roleData.displayName,
              description: roleData.description,
              level: roleData.level,
              isSystem: true
            }
          });

          if (roleData.permissions.length > 0) {
            await ctx.db.rolePermission.createMany({
              data: roleData.permissions.map(permissionId => ({
                roleId: role.id,
                permissionId
              }))
            });
          }
        }

        await auditLog(ctx, 'system.initialize', undefined, {
          permissionCount: permissions.length,
          roleCount: roles.length
        });

        return { 
          success: true, 
          message: `Created ${roles.length} roles and ${permissions.length} permissions` 
        };
      } catch (error) {
        console.error("Failed to initialize role system:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to initialize role system'
        });
      }
    })
});