/** @jest-environment node */
import type { Prisma, PrismaClient } from "@prisma/client";
import { withRealmMapSettings } from "~/lib/maps/realm-map-settings";
import { updateRealmSettings } from "~/server/modules/realms/realm-settings";
import { withMaxNationsPerUser } from "~/server/modules/realms/realms.settings";
import { fakeDb } from "~/tests/server/maps/map-import-fakes";

describe("updateRealmSettings", () => {
  it("locks the realm row inside a transaction and passes the freshly stored settings to mutate", async () => {
    const db = fakeDb();
    db.realm.rows.push({
      id: "r1",
      slug: "eurth",
      name: "Eurth",
      ownerId: "u1",
      settings: { existingKey: "kept" },
    });

    const received: unknown[] = [];
    const result = await updateRealmSettings(db as unknown as PrismaClient, "r1", (settings) => {
      received.push(settings);
      return { ...(settings as Record<string, unknown>), addedKey: 42 };
    });

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    const [sql, lockedId] = db.$queryRaw.mock.calls[0] as [TemplateStringsArray, string];
    expect(sql.join("?")).toContain("SELECT id FROM realms WHERE id = ? FOR UPDATE");
    expect(lockedId).toBe("r1");
    expect(received).toEqual([{ existingKey: "kept" }]);
    expect(result).toEqual({ existingKey: "kept", addedKey: 42 });
    expect(db.realm.rows[0]?.settings).toEqual({ existingKey: "kept", addedKey: 42 });
  });

  it("preserves both keys across sequential updates to different settings sections", async () => {
    const db = fakeDb();
    db.realm.rows.push({
      id: "r1",
      slug: "eurth",
      name: "Eurth",
      ownerId: "u1",
      settings: {},
    });

    await updateRealmSettings(db as unknown as PrismaClient, "r1", (settings) =>
      withMaxNationsPerUser(settings as Prisma.JsonValue, 5)
    );

    await updateRealmSettings(db as unknown as PrismaClient, "r1", (settings) =>
      withRealmMapSettings(settings, {
        defaultView: { center: [10, 20], zoom: 4 },
      })
    );

    const saved = db.realm.rows[0]?.settings as Record<string, unknown>;
    expect(saved.maxNationsPerUser).toBe(5);
    expect(saved.map).toMatchObject({ defaultView: { center: [10, 20], zoom: 4 } });
  });

  it("reuses an existing transaction client when $transaction is not present", async () => {
    const db = fakeDb();
    db.realm.rows.push({
      id: "r1",
      slug: "eurth",
      name: "Eurth",
      ownerId: "u1",
      settings: { initial: true },
    });
    const { $transaction: _tx, ...txClient } = db;

    await updateRealmSettings(
      txClient as unknown as Prisma.TransactionClient,
      "r1",
      (settings) => ({ ...(settings as Record<string, unknown>), fromTx: true })
    );

    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    expect(db.realm.rows[0]?.settings).toEqual({ initial: true, fromTx: true });
  });
});
