/**
 * VT-12: equipped cosmetics were visible only to their owner. `loadPublicCosmetics` lets anyone
 * render another player's glow, badge and frame, batched, and returns render data only.
 */
import {
  loadPublicCosmetics,
  MAX_PUBLIC_COSMETICS_LOOKUP,
  parseEquippedCosmetics,
  resolvePublicCosmetics,
} from "~/lib/vault/public-cosmetics";
import { createCallerFactory } from "~/server/api/trpc";
import { vaultPublicCosmeticsRouter } from "~/server/api/routers/vault/public-cosmetics";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const ACTIVE = new Map<string, unknown>([
  ["cosmetic_gold_glow", null],
  ["cosmetic_chat_badge", null],
  ["cosmetic_neon_frame", null],
  [
    "custom_badge",
    { customizations: { chatBadge: { enabled: true, icon: "Star", color: "#fff" } } },
  ],
]);

describe("resolvePublicCosmetics", () => {
  it("resolves catalog cosmetics into glow, badge and frame", () => {
    const out = resolvePublicCosmetics(
      ["cosmetic_gold_glow", "cosmetic_chat_badge", "cosmetic_neon_frame"],
      ACTIVE
    );
    expect(out.equipped).toEqual([
      "cosmetic_gold_glow",
      "cosmetic_chat_badge",
      "cosmetic_neon_frame",
    ]);
    expect(out.avatarGlow).toMatchObject({ enabled: true, color: "rgba(245,158,11,0.65)" });
    expect(out.chatBadge).toMatchObject({ enabled: true, icon: "Crown" });
    expect(out.neonFrame).toMatchObject({ enabled: true, color: "#22d3ee", style: "pulse" });
  });

  it("falls back to the store item's stored customizations", () => {
    const out = resolvePublicCosmetics(["custom_badge"], ACTIVE);
    expect(out.chatBadge).toEqual({ enabled: true, icon: "Star", color: "#fff" });
  });

  it("ignores ids that are not active cosmetics", () => {
    const out = resolvePublicCosmetics(["cosmetic_ruby_frame", "upgrade_card_capacity"], ACTIVE);
    expect(out.equipped).toEqual([]);
    expect(out.neonFrame.enabled).toBe(false);
  });

  it("parses the comma-separated equipped list", () => {
    expect(parseEquippedCosmetics("a,,b")).toEqual(["a", "b"]);
    expect(parseEquippedCosmetics(null)).toEqual([]);
  });
});

function makeDb(
  users: Array<{ id: string; clerkUserId: string; forumUserId: number | null; equipped: string }>
) {
  return {
    user: {
      findMany: jest.fn().mockResolvedValue(
        users.map(({ equipped, ...user }) => ({
          ...user,
          vault: { equippedCosmetics: equipped },
        }))
      ),
    },
    vaultStoreItem: {
      findMany: jest
        .fn()
        .mockResolvedValue([...ACTIVE.entries()].map(([id, effects]) => ({ id, effects }))),
    },
  };
}

describe("loadPublicCosmetics", () => {
  const db = () =>
    makeDb([
      { id: "u1", clerkUserId: "clerk_1", forumUserId: 11, equipped: "cosmetic_chat_badge" },
      { id: "u2", clerkUserId: "clerk_2", forumUserId: 12, equipped: "" },
      { id: "u3", clerkUserId: "clerk_3", forumUserId: null, equipped: "cosmetic_gold_glow" },
    ]);

  it("answers a whole page in two queries, keyed as requested", async () => {
    const mock = db();
    const result = await loadPublicCosmetics(mock as never, {
      userIds: ["clerk_3"],
      forumUserIds: [11, 12, 11],
    });

    expect(mock.user.findMany).toHaveBeenCalledTimes(1);
    expect(mock.vaultStoreItem.findMany).toHaveBeenCalledTimes(1);
    expect(mock.user.findMany.mock.calls[0][0].where).toEqual({
      isActive: true,
      OR: [
        { id: { in: ["clerk_3"] } },
        { clerkUserId: { in: ["clerk_3"] } },
        { forumUserId: { in: [11, 12] } },
      ],
    });
    expect(mock.vaultStoreItem.findMany.mock.calls[0][0].where).toMatchObject({
      category: "cosmetics",
      isActive: true,
    });
    expect(Object.keys(result.forumUsers)).toEqual(["11"]); // u2 has nothing equipped
    expect(result.forumUsers["11"]?.chatBadge.enabled).toBe(true);
    expect(result.users.clerk_3?.avatarGlow.enabled).toBe(true);
  });

  it("returns render data only, never wallet or inventory fields", async () => {
    const result = await loadPublicCosmetics(db() as never, { forumUserIds: [11] });
    expect(Object.keys(result.forumUsers["11"]!).sort()).toEqual([
      "avatarGlow",
      "chatBadge",
      "equipped",
      "neonFrame",
    ]);
    expect(JSON.stringify(result)).not.toMatch(/credits|balance|purchase/i);
  });

  it("skips the database for an empty lookup and caps a long one", async () => {
    const mock = db();
    await expect(loadPublicCosmetics(mock as never, {})).resolves.toEqual({
      users: {},
      forumUsers: {},
    });
    expect(mock.user.findMany).not.toHaveBeenCalled();

    const many = Array.from({ length: MAX_PUBLIC_COSMETICS_LOOKUP + 10 }, (_, i) => i + 1);
    await loadPublicCosmetics(mock as never, { forumUserIds: many });
    const or = mock.user.findMany.mock.calls[0][0].where.OR;
    expect(or[0].forumUserId.in).toHaveLength(MAX_PUBLIC_COSMETICS_LOOKUP);
  });
});

describe("vault.getEquippedCosmeticsFor", () => {
  const createCaller = createCallerFactory(vaultPublicCosmeticsRouter);

  it("is public: a signed-out viewer can read another player's cosmetics", async () => {
    const caller = createCaller(
      createMockRouterContext({ auth: null, user: null, db: makeDb([]) }) as never
    );
    await expect(caller.getEquippedCosmeticsFor({ userIds: ["u1"] })).resolves.toEqual({
      users: {},
      forumUsers: {},
    });
  });

  it("refuses more ids than one lookup allows", async () => {
    const caller = createCaller(createMockRouterContext({ db: makeDb([]) }) as never);
    const tooMany = Array.from({ length: MAX_PUBLIC_COSMETICS_LOOKUP + 1 }, (_, i) => `u${i}`);
    await expect(caller.getEquippedCosmeticsFor({ userIds: tooMany })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});
