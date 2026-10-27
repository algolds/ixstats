/**
 * A released nation's material (ToS §2.7, §2.8): its flag and coat of arms move into a `NationMaterialHold`, hidden
 * from display. The former holder's claim within the hold's window restores them; anyone else's approved claim
 * ends the window; the realm-inactivity job purges due holds and the local images they name.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { holdPurgeAfter, type HoldReason } from "~/lib/realms/realm-content";

type MaterialTx = Pick<Prisma.TransactionClient, "country" | "nationMaterialHold">;

/** Inside the releasing transaction, before or after the release itself: hide the nation's flag and arms. */
export async function holdNationMaterial(
  tx: MaterialTx,
  input: { countryId: string; formerOwnerUserId: string; reason: HoldReason; now?: Date }
): Promise<void> {
  const country = await tx.country.findUnique({
    where: { id: input.countryId },
    select: { flag: true, coatOfArms: true },
  });
  if (!country) return;
  const now = input.now ?? new Date();
  const hold = {
    formerOwnerUserId: input.formerOwnerUserId,
    reason: input.reason,
    flag: country.flag,
    coatOfArms: country.coatOfArms,
    heldAt: now,
    purgeAfter: holdPurgeAfter(input.reason, now),
  };
  // ponytail: a hold still waiting for its purge is replaced; local images are named per nation, so they are the
  // same files, and only an image under another name would be left behind.
  await tx.nationMaterialHold.upsert({
    where: { countryId: input.countryId },
    create: { countryId: input.countryId, ...hold },
    update: hold,
  });
  await tx.country.update({
    where: { id: input.countryId },
    data: { flag: null, coatOfArms: null, inactivityNoticeAt: null },
  });
}

/** Whether `hold` is still in its window at `now` (restorable by its former holder). */
function inWindow(hold: { purgeAfter: Date }, now: Date): boolean {
  return hold.purgeAfter.getTime() > now.getTime();
}

/**
 * Inside the approving transaction, after the nation is assigned to `userId`: their own reclaim within the window
 * restores the material; anyone else's approval ends the window, and the next purge removes it (§2.8(c)).
 */
export async function settleMaterialHold(
  tx: MaterialTx,
  countryId: string,
  userId: string,
  now = new Date()
): Promise<void> {
  const hold = await tx.nationMaterialHold.findUnique({ where: { countryId } });
  if (!hold) return;
  if (hold.formerOwnerUserId === userId && inWindow(hold, now)) {
    await tx.country.update({
      where: { id: countryId },
      data: { flag: hold.flag, coatOfArms: hold.coatOfArms },
    });
    await tx.nationMaterialHold.delete({ where: { countryId } });
    return;
  }
  await tx.nationMaterialHold.update({ where: { countryId }, data: { purgeAfter: now } });
}

/**
 * How a claim by `userId` on `countryId` stands against the nation's hold: `formerHolder` when they may restore it
 * now, `reservedForOther` when the realm keeps an inactive nation for its former holder during the window.
 */
export async function holdStanding(
  db: Pick<PrismaClient, "nationMaterialHold">,
  input: { countryId: string; userId: string; exclusiveWindow: boolean; now?: Date }
): Promise<{ formerHolder: boolean; reservedForOther: boolean }> {
  const hold = await db.nationMaterialHold.findUnique({
    where: { countryId: input.countryId },
    select: { formerOwnerUserId: true, reason: true, purgeAfter: true },
  });
  if (!hold || !inWindow(hold, input.now ?? new Date()))
    return { formerHolder: false, reservedForOther: false };
  const formerHolder = hold.formerOwnerUserId === input.userId;
  return {
    formerHolder,
    reservedForOther: !formerHolder && input.exclusiveWindow && hold.reason === "inactive",
  };
}

/** Delete every hold due at `now`, then the local images they named that no nation shows. */
export async function purgeDueHolds(
  db: Pick<PrismaClient, "nationMaterialHold">,
  deleteImages: (images: (string | null)[]) => Promise<number>,
  now: Date
): Promise<{ purged: number; files: number }> {
  const due = await db.nationMaterialHold.findMany({
    where: { purgeAfter: { lte: now } },
    select: { countryId: true, flag: true, coatOfArms: true },
  });
  if (due.length === 0) return { purged: 0, files: 0 };
  // Guarded on the deadline: a hold restored or replaced since the read is not touched.
  const { count } = await db.nationMaterialHold.deleteMany({
    where: { countryId: { in: due.map((h) => h.countryId) }, purgeAfter: { lte: now } },
  });
  const files = await deleteImages(due.flatMap((h) => [h.flag, h.coatOfArms]));
  return { purged: count, files };
}
