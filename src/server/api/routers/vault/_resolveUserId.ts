/**
 * Resolve the internal `User.id` for the current request.
 *
 * Critical: `MyVault.userId` (and therefore the vault relation on
 * `VaultTransaction`) stores the internal `User.id`, NOT the Clerk id — see
 * `vault-service.ts getOrCreateVault`. Several vault read endpoints historically
 * queried by `ctx.auth.userId` (the Clerk id), which never matched, so ownership
 * and equipped-cosmetics always came back empty (purchases "did nothing", no
 * equip UI, duplicate buys allowed). Always resolve through this before querying
 * MyVault / its transactions by user.
 */
export async function resolveVaultUserId(ctx: any): Promise<string> {
  const authId = ctx.auth?.userId;
  if (!authId) throw new Error("Unauthorized");
  const user = await ctx.db.user.findFirst({
    where: { OR: [{ id: authId }, { clerkUserId: authId }] },
    select: { id: true },
  });
  if (!user) throw new Error("User not found");
  return user.id;
}
