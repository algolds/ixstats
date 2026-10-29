/**
 * Leaving an alliance (owner ruling 2026-10-28): when the founder goes, the founder role passes to the longest-standing
 * active member (earliest join); when the last member goes, the alliance dissolves.
 */
import type { PrismaClient } from "@prisma/client";

interface LeaveResult {
  left: boolean;
  dissolved: boolean;
  /** The country that became founder, when the role passed on. */
  newFounderCountryId: string | null;
}

export async function leaveAllianceMembership(
  db: PrismaClient,
  membership: { id: string; allianceId: string }
): Promise<LeaveResult> {
  return db.$transaction(async (tx) => {
    const left = await tx.allianceMember.updateMany({
      where: { id: membership.id, isActive: true },
      // A role means something only while active: a founder who rejoins later comes back as a member.
      data: { isActive: false, status: "left", role: "member" },
    });
    if (left.count === 0) return { left: false, dissolved: false, newFounderCountryId: null };

    const remaining = await tx.allianceMember.findMany({
      where: { allianceId: membership.allianceId, isActive: true },
      orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
      select: { id: true, role: true, countryId: true },
    });
    if (remaining.length === 0) {
      await tx.alliance.delete({ where: { id: membership.allianceId } });
      return { left: true, dissolved: true, newFounderCountryId: null };
    }

    const heir = remaining.some((m) => m.role === "founder") ? null : remaining[0]!;
    if (heir) await tx.allianceMember.update({ where: { id: heir.id }, data: { role: "founder" } });
    await tx.alliance.update({
      where: { id: membership.allianceId },
      data: { memberCount: remaining.length },
    });
    return { left: true, dissolved: false, newFounderCountryId: heir?.countryId ?? null };
  });
}
