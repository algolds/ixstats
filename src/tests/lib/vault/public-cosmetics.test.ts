/**
 * VT-12: equipped cosmetics were visible only to their owner. `loadPublicCosmetics` lets anyone
 * render another player's glow, badge and frame, batched, and returns render data only.
 */
import {
  loadPublicCosmetics,
  MAX_PUBLIC_COSMETICS_LOOKUP,
  previewCosmetic,
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

function makeDb(users: Array<{ id: string; clerkUserId: string; equipped: string }>) {
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
      { id: "u1", clerkUserId: "clerk_1", equipped: "cosmetic_chat_badge" },
      { id: "u2", clerkUserId: "clerk_2", equipped: "" },
      { id: "u3", clerkUserId: "clerk_3", equipped: "cosmetic_gold_glow" },
    ]);
  it("returns render data only, never wallet or inventory fields", async () => {
    const result = await loadPublicCosmetics(db() as never, { userIds: ["u1"] });
    expect(Object.keys(result.users.u1!).sort()).toEqual([
      "avatarGlow",
      "chatBadge",
      "equipped",
      "neonFrame",
    ]);
    expect(JSON.stringify(result)).not.toMatch(/credits|balance|purchase/i);
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

describe("previewCosmetic", () => {
  it("resolves a catalog cosmetic to its own effect, so the store card wears the real style", () => {
    const ruby = previewCosmetic("cosmetic_ruby_frame", null);
    expect(ruby?.neonFrame).toEqual({ enabled: true, color: "#ef4444", style: "ruby" });
    expect(ruby?.avatarGlow.enabled).toBe(false);
    expect(previewCosmetic("cosmetic_summer_glow", null)?.avatarGlow).toMatchObject({
      enabled: true,
      style: "summer",
    });
  });

  it("falls back to the store item's stored effects for non-catalog cosmetics", () => {
    const effects = {
      customizations: { chatBadge: { enabled: true, icon: "Star", color: "#fff" } },
    };
    expect(previewCosmetic("custom_badge", effects)?.chatBadge).toEqual({
      enabled: true,
      icon: "Star",
      color: "#fff",
    });
  });

  it("returns null when the item has no renderable effect", () => {
    expect(previewCosmetic("upgrade_slots", { slots: 10 })).toBeNull();
  });
});
