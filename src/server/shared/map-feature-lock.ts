/**
 * `editableByOwner` on subdivisions, cities, peaks, named rivers and named lakes (PL-21): when an admin sets it to
 * false, the country's owner can no longer change or delete that feature. Admins always can — the country-owner
 * middleware gives privileged writers `ctx.country === null`, so a set `ctx.country` means a player acting as owner.
 */
import { TRPCError } from "@trpc/server";

export function assertOwnerMayEdit(
  ctx: { country?: object | null },
  feature: { editableByOwner?: boolean | null } | null | undefined,
  label = "feature"
): void {
  if (ctx.country && feature?.editableByOwner === false) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `This ${label} is locked: only an admin can change it`,
    });
  }
}
