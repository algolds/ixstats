/** @jest-environment node */
/** Unspent lore tokens are refunded at purchase price (cards refresh spec §2.2). */
import {
  LORE_TOKEN_ITEM_IDS,
  loreTokensOf,
  planLoreTokenRefunds,
  tokensByItem,
  tokensUsed,
  type TokenPurchase,
} from "~/lib/vault/lore-token-refunds";
import { isRetiredStoreItem } from "~/lib/vault/retired-store-items";

const purchase = (
  id: string,
  itemId: string,
  credits: number,
  tokens: number,
  day: number,
  vaultId = "v1"
): TokenPurchase => ({
  id,
  vaultId,
  userId: `u_${vaultId}`,
  itemId,
  credits,
  tokens,
  createdAt: new Date(Date.UTC(2026, 9, day)),
});

describe("planLoreTokenRefunds", () => {
  it("spends used tokens oldest purchase first and refunds the rest at purchase price", () => {
    const refunds = planLoreTokenRefunds(
      [
        purchase("p2", "upgrade_lore_token", -2500, 1, 2),
        purchase("p1", "upgrade_lore_token", -2500, 1, 1),
      ],
      new Map([["v1", 1]]),
      []
    );
    expect(refunds).toEqual([
      {
        vaultId: "v1",
        userId: "u_v1",
        itemId: "upgrade_lore_token",
        sourceTransactionId: "p2",
        amount: 2500,
        tokens: 1,
        idempotencyKey: "retired_item_refund:p2",
      },
    ]);
  });

  it("refunds part of a multi-token purchase, to the cent", () => {
    const used = new Map([["v1", 1]]);
    const whole = planLoreTokenRefunds(
      [purchase("p1", "upgrade_lore_token", -3000, 3, 1)],
      used,
      []
    );
    expect(whole).toEqual([expect.objectContaining({ amount: 2000, tokens: 2 })]);
    const cents = planLoreTokenRefunds(
      [purchase("p1", "upgrade_lore_token", -2500, 3, 1)],
      used,
      []
    );
    expect(cents[0]?.amount).toBe(1666.67);
  });

  it("never refunds tokens that came with another item, but counts them as spent first when older", () => {
    const refunds = planLoreTokenRefunds(
      [
        purchase("club", "upgrade_myclub_license", -5000, 1, 1),
        purchase("tok", "upgrade_lore_token", -2500, 1, 2),
      ],
      new Map([["v1", 1]]),
      []
    );
    expect(refunds.map((r) => r.sourceTransactionId)).toEqual(["tok"]);
  });

  it("counts archetype tokens as spent last, so a used token is never one its own script refunds in full", () => {
    const purchases = [
      purchase("arch", "upgrade_archetype_proposal", -3500, 1, 1),
      purchase("tok", "upgrade_lore_token", -2500, 1, 2),
    ];
    expect(planLoreTokenRefunds(purchases, new Map([["v1", 1]]), [])).toEqual([]);
    expect(
      planLoreTokenRefunds(purchases, new Map(), []).map((r) => r.sourceTransactionId)
    ).toEqual(["tok"]);
  });

  it("never refunds a token granted free, which still counts as spent first when older", () => {
    const refunds = planLoreTokenRefunds(
      [
        purchase("grant", "upgrade_lore_token", 0, 1, 1),
        purchase("bought", "upgrade_lore_token", -2500, 1, 2),
        purchase("grant2", "upgrade_lore_token", 0, 1, 3),
      ],
      new Map([["v1", 1]]),
      []
    );
    expect(refunds.map((r) => r.sourceTransactionId)).toEqual(["bought"]);
  });

  it("refunds what was paid: a shortfall the exploit audit took back counts, a refund already given does not", () => {
    const refunds = planLoreTokenRefunds(
      [
        purchase("short", "upgrade_lore_token", -1, 1, 1),
        purchase("given", "upgrade_lore_token", -2500, 1, 2),
      ],
      new Map(),
      [
        { credits: -2499, metadata: JSON.stringify({ sourceTransactionId: "short" }) },
        { credits: 2500, metadata: { sourceTransactionId: "given" } },
      ]
    );
    expect(refunds).toEqual([
      expect.objectContaining({ sourceTransactionId: "short", amount: 2500 }),
    ]);
  });

  it("breaks a tie on purchase time by id, so a re-run plans the same refund whatever the row order", () => {
    const a = purchase("a", "upgrade_lore_token", -2500, 1, 1);
    const b = purchase("b", "upgrade_lore_token", -2500, 1, 1);
    const used = new Map([["v1", 1]]);
    expect(planLoreTokenRefunds([a, b], used, []).map((r) => r.sourceTransactionId)).toEqual(["b"]);
    expect(planLoreTokenRefunds([b, a], used, []).map((r) => r.sourceTransactionId)).toEqual(["b"]);
  });

  it("counts each vault's used tokens against its own purchases", () => {
    const refunds = planLoreTokenRefunds(
      [
        purchase("p1", "upgrade_lore_token", -2500, 1, 1, "v1"),
        purchase("p2", "upgrade_lore_token", -2500, 1, 1, "v2"),
      ],
      new Map([["v1", 1]]),
      []
    );
    expect(refunds).toEqual([
      expect.objectContaining({ vaultId: "v2", userId: "u_v2", sourceTransactionId: "p2" }),
    ]);
  });

  it("refunds nothing when every token was used, or the purchase granted none", () => {
    expect(
      planLoreTokenRefunds(
        [purchase("p1", "upgrade_lore_token", -2500, 1, 1)],
        new Map([["v1", 4]]),
        []
      )
    ).toEqual([]);
    expect(
      planLoreTokenRefunds([purchase("p1", "upgrade_lore_token", -2500, 0, 1)], new Map(), [])
    ).toEqual([]);
  });

  it("sells tokens only as the Lore Request Token, which is not a retired item", () => {
    expect(LORE_TOKEN_ITEM_IDS).toEqual(["upgrade_lore_token"]);
    expect(LORE_TOKEN_ITEM_IDS.filter(isRetiredStoreItem)).toEqual([]);
  });
});

describe("token accounting", () => {
  it("counts a request marker that spent a token, less one a rejection gave back, in string or object metadata", () => {
    expect(
      tokensUsed([
        { metadata: JSON.stringify({ useToken: true }) },
        { metadata: { useToken: true } },
        { metadata: { tokenRefund: true } },
        { metadata: { useToken: false } },
        { metadata: "not json" },
      ])
    ).toBe(1);
  });

  it("never counts below zero", () => {
    expect(tokensUsed([{ metadata: { tokenRefund: true } }, { metadata: null }])).toBe(0);
  });

  it("reads the perk from an item's effects", () => {
    expect(loreTokensOf({ perks: { loreTokens: 2 } })).toBe(2);
    expect(loreTokensOf({ perks: { cardCapacity: 50 } })).toBe(0);
    expect(loreTokensOf({ perks: { loreTokens: -1 } })).toBe(0);
    expect(loreTokensOf({ perks: { loreTokens: "2" } })).toBe(0);
    expect(loreTokensOf({ perks: [2] })).toBe(0);
    expect(loreTokensOf(null)).toBe(0);
  });
});

describe("tokensByItem", () => {
  it("maps each item carrying the perk to its tokens per purchase", () => {
    expect(
      tokensByItem([
        { id: "upgrade_lore_token", effects: { perks: { loreTokens: 1 } } },
        { id: "upgrade_myclub_license", effects: { perks: { loreTokens: 2 } } },
        { id: "frame_gold", effects: null },
      ])
    ).toEqual(
      new Map([
        ["upgrade_lore_token", 1],
        ["upgrade_myclub_license", 2],
      ])
    );
  });

  it("refuses to plan when no lore token item reports a token count, rather than refunding nothing", () => {
    const missing = /upgrade_lore_token.*nothing was written/;
    expect(() =>
      tokensByItem([{ id: "upgrade_myclub_license", effects: { perks: { loreTokens: 1 } } }])
    ).toThrow(missing);
    expect(() => tokensByItem([{ id: "upgrade_lore_token", effects: null }])).toThrow(missing);
  });
});
