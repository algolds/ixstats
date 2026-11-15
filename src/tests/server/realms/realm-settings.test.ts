/** @jest-environment node */
import type { Prisma } from "@prisma/client";
import { withRealmMapSettings } from "~/lib/maps/realm-map-settings";
import { updateRealmSettings } from "~/server/modules/realms/realm-settings";
import { withMaxNationsPerUser } from "~/server/modules/realms/realms.settings";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";

const LOCK = /SELECT id FROM realms WHERE id = \? FOR UPDATE/;

/** A client holding realm `r1` with these settings, and the ids its row lock was taken for. */
async function realmWith(settings: Prisma.InputJsonValue): Promise<{
  db: MemoryPrisma;
  locked: unknown[];
}> {
  const db = createMemoryPrisma();
  const locked: unknown[] = [];
  db.store.onRaw(LOCK, ([id]) => {
    locked.push(id);
    return [{ id }];
  });
  await db.realm.create({
    data: { id: "r1", slug: "eurth", name: "Eurth", ownerId: "u1", settings },
  });
  return { db, locked };
}

const stored = async (db: MemoryPrisma) =>
  (await db.realm.findUnique({ where: { id: "r1" }, select: { settings: true } }))?.settings;

describe("updateRealmSettings", () => {
  it("locks the realm row inside a transaction and passes the freshly stored settings to mutate", async () => {
    const { db, locked } = await realmWith({ existingKey: "kept" });
    const received: unknown[] = [];

    const result = await updateRealmSettings(db, "r1", (settings) => {
      received.push(settings);
      return { ...(settings as Record<string, unknown>), addedKey: 42 };
    });

    expect(locked).toEqual(["r1"]);
    expect(received).toEqual([{ existingKey: "kept" }]);
    expect(result).toEqual({ existingKey: "kept", addedKey: 42 });
    expect(await stored(db)).toEqual({ existingKey: "kept", addedKey: 42 });
  });

  it("preserves both keys across sequential updates to different settings sections", async () => {
    const { db } = await realmWith({});

    await updateRealmSettings(db, "r1", (settings) =>
      withMaxNationsPerUser(settings as Prisma.JsonValue, 5)
    );
    await updateRealmSettings(db, "r1", (settings) =>
      withRealmMapSettings(settings, { defaultView: { center: [10, 20], zoom: 4 } })
    );

    const saved = (await stored(db)) as Record<string, unknown>;
    expect(saved.maxNationsPerUser).toBe(5);
    expect(saved.map).toMatchObject({ defaultView: { center: [10, 20], zoom: 4 } });
  });

  it("reuses an existing transaction client and still takes the row lock", async () => {
    const { db, locked } = await realmWith({ initial: true });

    await db.$transaction((tx) =>
      updateRealmSettings(tx, "r1", (settings) => ({
        ...(settings as Record<string, unknown>),
        fromTx: true,
      }))
    );

    expect(locked).toEqual(["r1"]);
    expect(await stored(db)).toEqual({ initial: true, fromTx: true });
  });
});
