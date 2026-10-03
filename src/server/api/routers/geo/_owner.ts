import { TRPCError } from "@trpc/server";

/**
 * Country owners may only act on their own country; admins (no `ctx.country`) may act on any.
 * `action` completes "You can only ... your own country".
 */
export function assertOwnCountry(
  ctx: { country?: object | null },
  countryId: string,
  action = "edit"
) {
  const owned = ctx.country as { id: string } | null | undefined;
  if (owned && owned.id !== countryId) {
    throw new TRPCError({ code: "FORBIDDEN", message: `You can only ${action} your own country` });
  }
}
