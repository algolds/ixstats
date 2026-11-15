/** @jest-environment node */
import type { PrismaClient } from "@prisma/client";
import { listRealmSelectList } from "~/server/api/routers/realms/places";
import { DIRECTORY_REALM_WHERE } from "~/server/shared/realm-directory";

describe("listRealmSelectList", () => {
  it("runs a single findMany query over DIRECTORY_REALM_WHERE and maps claimable nationCount", async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: "r-aurora",
        slug: "aurora-reach",
        name: "Aurora Reach",
        description: "Maritime trade leagues",
        thumbnail: "/uploads/aurora.png",
        tags: ["maritime", "trade"],
        _count: { countries: 14 },
      },
    ]);
    const db = { realm: { findMany } } as unknown as PrismaClient;

    const result = await listRealmSelectList(db);

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: DIRECTORY_REALM_WHERE,
      orderBy: { name: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        thumbnail: true,
        tags: true,
        _count: { select: { countries: { where: { claimable: true } } } },
      },
    });
    expect(result).toEqual([
      {
        id: "r-aurora",
        slug: "aurora-reach",
        name: "Aurora Reach",
        description: "Maritime trade leagues",
        thumbnail: "/uploads/aurora.png",
        tags: ["maritime", "trade"],
        nationCount: 14,
      },
    ]);
    expect(result[0]).not.toHaveProperty("_count");
    expect(result[0]).not.toHaveProperty("settings");
  });
});
