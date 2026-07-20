/**
 * Centralized User Management Service
 *
 * Provides a single source of truth for user creation and retrieval with:
 * - Database transaction locking to prevent race conditions
 * - System owner role detection and preservation
 * - Consistent user creation logic across the application
 */

import { clerkClient } from "@clerk/nextjs/server";
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
    if (!clerkUserId || clerkUserId.trim() === "") {
      console.warn("[UserManagementService] Invalid clerkUserId provided");
      return null;
    }

    try {
      // First, try to find existing user (preserves existing roles/data)
      // Include country to avoid redundant re-fetch in countryOwnerMiddleware
      const existingUser = await this.db.user.findUnique({
        where: { clerkUserId },
        include: {
          role: true,
          country: true,
        },
      });

      if (existingUser) {
        console.log(
          `[UserManagementService] Found existing user: ${clerkUserId}, role: ${existingUser.role?.name || "NO_ROLE"}`
        );
        return existingUser as UserWithRole;
      }

      // User doesn't exist - create with proper role assignment
      console.log(`[UserManagementService] Creating new user: ${clerkUserId}`);

      // Fetch metadata from Clerk if keys are available
      let reservedNationName: string | undefined = undefined;
      const hasClerkKeys = Boolean(
        process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
      );

      if (hasClerkKeys) {
        try {
          const client = await clerkClient();
          const clerkUser = await client.users.getUser(clerkUserId);
          if (clerkUser?.publicMetadata?.reservedNationName) {
            reservedNationName = String(clerkUser.publicMetadata.reservedNationName);
            console.log(
              `[UserManagementService] Clerk reserved nation name detected: ${reservedNationName} for user ${clerkUserId}`
            );
          }
        } catch (clerkError) {
          console.error(
            "[UserManagementService] Failed to fetch user metadata from Clerk:",
            clerkError
          );
        }
      }

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
        const roleName = isSystemOwnerUser ? "owner" : "user";

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

        if (reservedNationName) {
          try {
            await tx.nSVerification.create({
              data: {
                id: `nsv_waitlist_${Date.now()}_${newUser.id}`,
                userId: newUser.id,
                nationName: reservedNationName,
                verificationCode: "WAITLIST_PRE_VERIFIED",
                verified: true,
                verifiedAt: new Date(),
                expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
              },
            });
            console.log(
              `[UserManagementService] Pre-verified NationStates nation ${reservedNationName} for user ${clerkUserId}`
            );
          } catch (verifyError) {
            console.error(
              "[UserManagementService] Failed to auto-create NSVerification:",
              verifyError
            );
          }
        }

        console.log(
          `[UserManagementService] Created user: ${clerkUserId}, role: ${newUser.role?.name || "NO_ROLE"}, isSystemOwner: ${isSystemOwnerUser}`
        );
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
          console.log(
            `[UserManagementService] Retrieved user after creation failure: ${clerkUserId}`
          );
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
      where: { name: "owner" },
      update: {}, // Don't update existing
      create: {
        name: "owner",
        displayName: "System Owner",
        description: "Full system access and control",
        level: 0,
        isSystem: true,
        isActive: true,
      },
    });

    // Create admin role
    await db.role.upsert({
      where: { name: "admin" },
      update: {}, // Don't update existing
      create: {
        name: "admin",
        displayName: "Administrator",
        description: "Administrative access",
        level: 10,
        isSystem: true,
        isActive: true,
      },
    });

    // Create user role
    await db.role.upsert({
      where: { name: "user" },
      update: {}, // Don't update existing
      create: {
        name: "user",
        displayName: "Member",
        description: "Standard user access",
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
