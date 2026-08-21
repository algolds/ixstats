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

/**
 * Canonical country-write authorization assertion.
 *
 * Checks fast-path cached ownership/privilege, then falls back to a single fresh DB lookup.
 * If unauthorized, checks target country existence (throwing NOT_FOUND if missing)
 * before throwing FORBIDDEN.
 */
export async function assertCountryWriteAccess(
  ctx: CountryAuthContext,
  countryId: string
): Promise<void> {
  const authUserId = ctx.auth?.userId;
  if (!authUserId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }

  // 1. Check system owner or cached privileged role
  const cachedRole = getRoleName(ctx.user, ctx.auth?.sessionClaims);
  if (isPrivilegedCountryWriter(authUserId, cachedRole)) {
    return;
  }

  // 2. Check cached direct ownership
  if (ctx.user?.countryId && ctx.user.countryId === countryId) {
    return;
  }

  // 3. Fallback: fresh DB lookup for stale or incomplete cached context
  const freshUser = await ctx.db.user.findUnique({
    where: { clerkUserId: authUserId },
    include: { role: true },
  });

  if (freshUser) {
    const freshRole = getRoleName(freshUser);
    if (isPrivilegedCountryWriter(authUserId, freshRole) || freshUser.countryId === countryId) {
      return;
    }
  }

  // 4. Verify target country existence if country delegate is available
  if (ctx.db.country?.findUnique) {
    const country = await ctx.db.country.findUnique({
      where: { id: countryId },
      select: { id: true },
    });
    if (!country) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Country not found",
      });
    }
  }

  throw new TRPCError({
    code: "FORBIDDEN",
    message: "You do not have permission to modify this country.",
  });
}
