/** Plan 345 Step 6: the shared SystemConfig read/write used by the admin config procedures. */
import { describe, it, expect, jest } from "@jest/globals";
import type { PrismaClient } from "@prisma/client";
import { readConfigKeys, writeConfigKey, writeConfigKeys } from "~/server/shared/config-kv";

function makeDb(rows: { key: string; value: string }[] = []) {
  const db = {
    systemConfig: {
      findMany: jest.fn(async (_args: object) => rows),
      upsert: jest.fn((args: object) => args),
    },
    $transaction: jest.fn(async (ops: object[]) => ops),
  };
  return { db, client: db as never as PrismaClient };
}

describe("admin _config-kv", () => {
  it("reads only the requested keys into a key → value map", async () => {
    const { db, client } = makeDb([{ key: "a", value: "1" }]);
    await expect(readConfigKeys(client, ["a", "b"])).resolves.toEqual({ a: "1" });
    expect(db.systemConfig.findMany).toHaveBeenCalledWith({ where: { key: { in: ["a", "b"] } } });
  });

  it("upserts every update in one transaction, describing new rows", async () => {
    const { db, client } = makeDb();
    await writeConfigKeys(client, [{ key: "a", value: "1" }], (key) => `about ${key}`);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.systemConfig.upsert).toHaveBeenCalledWith({
      where: { key: "a" },
      update: { value: "1" },
      create: { key: "a", value: "1", description: "about a" },
    });
  });

  it("upserts one key through the client it is given, which may be a transaction's", async () => {
    const upsert = jest.fn(async (args: object) => args);
    await writeConfigKey({ systemConfig: { upsert } } as never, "c", "2", "about c");
    expect(upsert).toHaveBeenCalledWith({
      where: { key: "c" },
      update: { value: "2" },
      create: { key: "c", value: "2", description: "about c" },
    });
  });

  it("leaves description unset when no describer is given", async () => {
    const { db, client } = makeDb();
    await writeConfigKeys(client, [{ key: "b", value: "true" }]);
    expect(db.systemConfig.upsert).toHaveBeenCalledWith({
      where: { key: "b" },
      update: { value: "true" },
      create: { key: "b", value: "true", description: undefined },
    });
  });
});
