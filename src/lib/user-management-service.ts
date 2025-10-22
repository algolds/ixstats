/**
 * Centralized User Management Service
 * 
 * Provides a single source of truth for user creation and retrieval with:
 * - Database transaction locking to prevent race conditions
 * - System owner role detection and preservation
 * - Consistent user creation logic across the application
 */

import type { PrismaClient, User, Role } from "@prisma/client";
import { SYSTEM_OWNER_IDS, isSystemOwner } from "./system-owner-constants";

interface UserWithRole extends User {
  role: Role | null;
}

export class UserManagementService {
  constructor(private db: PrismaClient) {}

  /**
   * Get or create a user record with proper role assignment
   * Uses database transactions to prevent race conditions
   */
  async getOrCreateUser(clerkUserId: string): Promise<UserWithRole | null> {
    if (!clerkUserId || clerkUserId.trim() === '') {
      console.warn('[UserManagementService] Invalid clerkUserId provided');
      return null;
    }

    try {
      // First, try to find existing user (preserves existing roles/data)
      const existingUser = await this.db.user.findUnique({
        where: { clerkUserId },
        include: {
          role: true,
        },
      });

      if (existingUser) {
        console.log(`[UserManagementService] Found existing user: ${clerkUserId}, role: ${existingUser.role?.name || 'NO_ROLE'}`);
        return existingUser as UserWithRole;
      }

      // User doesn't exist - create with proper role assignment
      console.log(`[UserManagementService] Creating new user: ${clerkUserId}`);
      
      // Use transaction to prevent race conditions during creation
      return await this.db.$transaction(async (tx) => {
        // Double-check user doesn't exist (race condition protection)
        const raceCheckUser = await tx.user.findUnique({
          where: { clerkUserId },
          include: { role: true },
        });

        if (raceCheckUser) {
          console.log(`[UserManagementService] User created by another process: ${clerkUserId}`);
          return raceCheckUser as UserWithRole;
        }

        // Ensure roles exist
        await this.ensureRolesExist(tx);

        // Determine role assignment
        const isSystemOwnerUser = isSystemOwner(clerkUserId);
        const roleName = isSystemOwnerUser ? 'owner' : 'user';
        
        const role = await tx.role.findUnique({
          where: { name: roleName },
        });

        if (!role) {
          throw new Error(`Role '${roleName}' not found after ensuring roles exist`);
        }

        // Create the user
        const newUser = await tx.user.create({
          data: {
            clerkUserId,
            roleId: role.id,
            isActive: true,
          },
          include: {
            role: true,
          },
        });

        console.log(`[UserManagementService] Created user: ${clerkUserId}, role: ${newUser.role?.name || 'NO_ROLE'}, isSystemOwner: ${isSystemOwnerUser}`);
        return newUser as UserWithRole;
      });

    } catch (error) {
      console.error(`[UserManagementService] Failed to get/create user ${clerkUserId}:`, error);
      
      // Try one more time to fetch existing user in case of race condition
      try {
        const fallbackUser = await this.db.user.findUnique({
          where: { clerkUserId },
          include: { role: true },
        });
        
        if (fallbackUser) {
          console.log(`[UserManagementService] Retrieved user after creation failure: ${clerkUserId}`);
          return fallbackUser as UserWithRole;
        }
      } catch (fallbackError) {
        console.error(`[UserManagementService] Fallback user fetch failed:`, fallbackError);
      }
      
      return null;
    }
  }

  /**
   * Ensure basic roles exist in the database
   */
  private async ensureRolesExist(tx?: any): Promise<void> {
    const db = tx || this.db;

    // Create owner role
    await db.role.upsert({
      where: { name: 'owner' },
      update: {}, // Don't update existing
      create: {
        name: 'owner',
        displayName: 'System Owner',
        description: 'Full system access and control',
        level: 0,
        isSystem: true,
        isActive: true,
      },
    });

    // Create admin role
    await db.role.upsert({
      where: { name: 'admin' },
      update: {}, // Don't update existing
      create: {
        name: 'admin',
        displayName: 'Administrator',
        description: 'Administrative access',
        level: 10,
        isSystem: true,
        isActive: true,
      },
    });

    // Create user role
    await db.role.upsert({
      where: { name: 'user' },
      update: {}, // Don't update existing
      create: {
        name: 'user',
        displayName: 'Member',
        description: 'Standard user access',
        level: 100,
        isSystem: true,
        isActive: true,
      },
    });
  }

  /**
   * Check if a Clerk user ID is a system owner
   */
  isSystemOwner(clerkUserId: string): boolean {
    return isSystemOwner(clerkUserId);
  }

  /**
   * Get system owner IDs for validation
   */
  getSystemOwnerIds(): readonly string[] {
    return SYSTEM_OWNER_IDS;
  }
}
