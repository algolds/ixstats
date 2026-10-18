/**
 * Fusing copies (cards refresh §2.2): the Economy tab's number of copies of one card at one finish become one copy at
 * the next finish. The lowest serial is kept and upgraded in place (with its own level and XP); the others burn.
 */
import type { CardFinish, PrismaClient } from "@prisma/client";
import { fusionBlocker } from "~/lib/cards/dust";
import { getEconomyConfig } from "~/lib/cards/economy-config";
import { nextFinish } from "~/lib/cards/finish";
import { recordTransferTx } from "~/lib/cards/transfer-events";
import {
  burnCopiesTx,
  changedError,
  judgedCopiesTx,
  precondition,
  readOwnCopiesTx,
} from "./copies";

/**
 * Fuses the player's copies, all or none. Refused unless they are exactly the Economy tab's number of copies of one
 * card at one finish below Holo, none bound, Serialised, signed, listed, auctioned or in a trade offer. The fused copy
 * is import-discounted when any input was, so fusing then breaking down never yields more dust than breaking the
 * inputs down. The upgrade, like the burn, holds only while the kept copy is as read.
 */
export async function fuseCopies(
  db: PrismaClient,
  input: { userId: string; ownershipIds: string[] }
): Promise<{ ownershipId: string; finish: CardFinish; serialNumber: number }> {
  const ids = [...new Set(input.ownershipIds)];
  const cfg = await getEconomyConfig(db);
  return db.$transaction(async (tx) => {
    const rows = await readOwnCopiesTx(tx, input.userId, ids);
    const blocked = fusionBlocker(await judgedCopiesTx(tx, rows), cfg);
    if (blocked) throw precondition(blocked);
    const [kept, ...spent] = rows;
    // fusionBlocker has refused any set without a next finish (Holo, Serialised), and any set smaller than two
    const finish = nextFinish(kept.finish) as CardFinish;

    await burnCopiesTx(tx, input.userId, spent, "FUSE");
    const upgraded = await tx.cardOwnership.updateMany({
      where: {
        id: kept.id,
        ownerId: input.userId,
        isLocked: false,
        inscription: null,
        finish: kept.finish,
        importDiscounted: kept.importDiscounted,
      },
      data: { finish, importDiscounted: rows.some((c) => c.importDiscounted) },
    });
    if (upgraded.count !== 1) throw changedError("FUSE");
    await recordTransferTx(tx, {
      ownershipId: kept.id,
      cardId: kept.cardId,
      serialNumber: kept.serialNumber,
      finish,
      fromUserId: input.userId,
      toUserId: input.userId,
      action: "FUSE",
    });
    return { ownershipId: kept.id, finish, serialNumber: kept.serialNumber };
  });
}
