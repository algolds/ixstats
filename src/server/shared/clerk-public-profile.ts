/**
 * A user's public Clerk profile for display: their profile picture and their Clerk role (`publicMetadata.role`).
 * Both are already public (the Passport shows the picture, profiles show the role). One Clerk read per user,
 * remembered for a while so a country page's refetches never hammer Clerk.
 */

export interface ClerkPublicProfile {
  imageUrl: string | null;
  role: string | null;
}

const TTL_MS = 10 * 60 * 1000;
// ponytail: per-process cache; move to Redis if several app instances ever serve the same users.
const cache = new Map<string, { at: number; profile: ClerkPublicProfile }>();

type ClerkUserReader = (clerkUserId: string) => Promise<{
  imageUrl?: string | null;
  publicMetadata?: Record<string, unknown> | null;
} | null>;

async function readFromClerk(clerkUserId: string) {
  const { clerkClient } = await import("@clerk/nextjs/server");
  const client = await clerkClient();
  return client.users.getUser(clerkUserId);
}

/** The profile, or nulls when Clerk is unreachable or the id is not a Clerk user; never throws. */
export async function clerkPublicProfile(
  clerkUserId: string | null | undefined,
  read: ClerkUserReader = readFromClerk,
  now = Date.now()
): Promise<ClerkPublicProfile> {
  const empty = { imageUrl: null, role: null };
  if (!clerkUserId?.startsWith("user_")) return empty;
  const hit = cache.get(clerkUserId);
  if (hit && now - hit.at < TTL_MS) return hit.profile;
  try {
    const user = await read(clerkUserId);
    const role = user?.publicMetadata?.role;
    const profile = {
      imageUrl: user?.imageUrl || null,
      role: typeof role === "string" && role.trim() ? role.trim() : null,
    };
    cache.set(clerkUserId, { at: now, profile });
    return profile;
  } catch {
    return empty;
  }
}
