import { TRPCError } from "@trpc/server";
import { isSystemOwner } from "~/lib/auth";

export const COUNTRY_WRITE_ROLES = ["admin", "owner", "staff", "system-owner"] as const;
export type CountryWriteRole = (typeof COUNTRY_WRITE_ROLES)[number];

export interface CountryAuthContext {
  auth?: {
    userId?: string | null;
    sessionClaims?: any;
  } | null;
  user?: {
    id?: string;
    clerkUserId?: string | null;
    countryId?: string | null;
    role?: { name?: string | null } | string | null;
    [key: string]: any;
  } | null;
  db: {
    user: {
      findUnique: (args: any) => Promise<any>;
      [key: string]: any;
    };
    country?: {
      findUnique?: (args: any) => Promise<any>;
      [key: string]: any;
    };
    [key: string]: any;
  };
}

/**
 * Extract role name consistently from user entity or session claims
 */
export function getRoleName(user?: unknown, sessionClaims?: unknown): string | undefined {
  if (typeof user === "string") return user;
  if (user && typeof user === "object") {
    const roleProp = (user as any).role;
    if (typeof roleProp === "string") return roleProp;
    if (roleProp && typeof roleProp === "object" && typeof roleProp.name === "string") {
      return roleProp.name;
    }
  }

  if (sessionClaims && typeof sessionClaims === "object") {
    const claimRole = (sessionClaims as any)?.metadata?.role;
    if (typeof claimRole === "string") return claimRole;
  }

  return undefined;
}

/**
 * Check if the user is a privileged writer (system owner or in COUNTRY_WRITE_ROLES)
 */
export function isPrivilegedCountryWriter(authUserId?: string | null, roleName?: string): boolean {
  if (authUserId && isSystemOwner(authUserId)) {
    return true;
  }
  if (typeof roleName === "string" && COUNTRY_WRITE_ROLES.includes(roleName as CountryWriteRole)) {
    return true;
  }
  return false;
}

function requireAuthUserId(ctx: CountryAuthContext): string {
  const authUserId = ctx.auth?.userId;
  if (!authUserId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }
  return authUserId;
}

function hasCachedPrivilege(ctx: CountryAuthContext, authUserId: string): boolean {
  return isPrivilegedCountryWriter(authUserId, getRoleName(ctx.user, ctx.auth?.sessionClaims));
}

interface FreshWriter {
  /** The platform user id (`User.id`), which `Country.ownerUserId` stores. */
  id: string | null;
  privileged: boolean;
  countryId: string | null;
}

/** Single fresh DB lookup for stale or incomplete cached context. */
async function findFreshWriter(
  ctx: CountryAuthContext,
  authUserId: string
): Promise<FreshWriter | null> {
  const freshUser = await ctx.db.user.findUnique({
    where: { clerkUserId: authUserId },
    include: { role: true },
  });
  if (!freshUser) return null;
  return {
    id: freshUser.id ?? null,
    privileged: isPrivilegedCountryWriter(authUserId, getRoleName(freshUser)),
    countryId: freshUser.countryId ?? null,
  };
}

/**
 * Canonical country-write authorization assertion.
 *
 * A writer is a privileged role, the user acting as the nation (`User.countryId`), or the
 * nation's owner (`Country.ownerUserId`): a player may own several nations and act on any of
 * them from its page without first switching their active one.
 *
 * Checks fast-path cached active nation/privilege, then falls back to a single fresh DB lookup.
 * If still unauthorized, loads the target country: NOT_FOUND if missing, allowed if the caller
 * owns it, FORBIDDEN otherwise.
 */
export async function assertCountryWriteAccess(
  ctx: CountryAuthContext,
  countryId: string
): Promise<void> {
  const authUserId = requireAuthUserId(ctx);

  // 1. Check system owner or cached privileged role
  if (hasCachedPrivilege(ctx, authUserId)) {
    return;
  }

  // 2. Check cached direct ownership
  if (ctx.user?.countryId && ctx.user.countryId === countryId) {
    return;
  }

  // 3. Fallback: fresh DB lookup for stale or incomplete cached context
  const freshWriter = await findFreshWriter(ctx, authUserId);
  if (freshWriter && (freshWriter.privileged || freshWriter.countryId === countryId)) {
    return;
  }

  // 4. Verify target country existence, and allow any nation the caller owns (not only the active one)
  if (ctx.db.country?.findUnique) {
    const country = await ctx.db.country.findUnique({
      where: { id: countryId },
      select: { id: true, ownerUserId: true },
    });
    if (!country) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Country not found",
      });
    }
    const userId = freshWriter?.id ?? ctx.user?.id ?? null;
    if (userId && country.ownerUserId === userId) {
      return;
    }
  }

  throw new TRPCError({
    code: "FORBIDDEN",
    message: "You do not have permission to modify this country.",
  });
}

/**
 * Assert write access for a row that belongs to a country.
 * `countryId` is the row's owning country as loaded from the DB;
 * null/undefined (row missing or orphaned) → NOT_FOUND for non-privileged callers.
 */
export async function assertCountryResourceWriteAccess(
  ctx: CountryAuthContext,
  countryId: string | null | undefined,
  resourceLabel: string
): Promise<void> {
  if (countryId) {
    await assertCountryWriteAccess(ctx, countryId);
    return;
  }

  const authUserId = requireAuthUserId(ctx);
  if (hasCachedPrivilege(ctx, authUserId)) {
    return;
  }
  const freshWriter = await findFreshWriter(ctx, authUserId);
  if (freshWriter?.privileged) {
    return;
  }

  throw new TRPCError({
    code: "NOT_FOUND",
    message: `${resourceLabel} not found`,
  });
}
