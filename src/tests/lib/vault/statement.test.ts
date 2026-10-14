import { describeRow, groupStatement, rowIconKey, type StatementRow } from "~/lib/vault/statement";

const NOW = new Date("2026-10-14T09:00:00.000Z");

function row(overrides: Partial<StatementRow> = {}): StatementRow {
  return {
    id: "tx1",
    createdAt: new Date("2026-10-14T08:00:00.000Z"),
    credits: 10,
    balanceAfter: 110,
    type: "EARN_ACTIVE",
    source: "SOCIAL_POST",
    metadata: null,
    ...overrides,
  };
}

describe("groupStatement", () => {
  it("labels today, yesterday and older days", () => {
    const days = groupStatement(
      [
        row({ id: "a" }),
        row({ id: "b", createdAt: new Date("2026-10-13T20:00:00.000Z") }),
        row({ id: "c", createdAt: new Date("2026-10-02T01:00:00.000Z") }),
      ],
      NOW
    );
    expect(days.map((d) => [d.key, d.label])).toEqual([
      ["2026-10-14", "Today"],
      ["2026-10-13", "Yesterday"],
      ["2026-10-02", "2 October"],
    ]);
  });

  it("groups by UTC day across midnight, keeping the row order", () => {
    const days = groupStatement(
      [
        row({ id: "a", createdAt: new Date("2026-10-14T00:00:01.000Z") }),
        row({ id: "b", createdAt: new Date("2026-10-13T23:59:59.000Z") }),
        row({ id: "c", createdAt: new Date("2026-10-13T00:00:00.000Z") }),
      ],
      NOW
    );
    expect(days.map((d) => d.rows.map((r) => r.id))).toEqual([["a"], ["b", "c"]]);
  });

  it("measures today and yesterday in UTC, whatever the clock", () => {
    const justAfterMidnight = new Date("2026-10-15T00:00:30.000Z");
    const days = groupStatement([row({ createdAt: NOW })], justAfterMidnight);
    expect(days[0]?.label).toBe("Yesterday");
  });

  it("adds the year to days outside the current year", () => {
    const days = groupStatement([row({ createdAt: new Date("2025-12-31T12:00:00.000Z") })], NOW);
    expect(days[0]?.label).toBe("31 December 2025");
  });

  it("returns no days for no rows", () => {
    expect(groupStatement([], NOW)).toEqual([]);
  });
});

describe("describeRow", () => {
  const lines = [
    { key: "interest", amount: 12, detail: { deckValue: 4800, rate: 0.0025 } },
    { key: "posts", amount: 4, detail: { posts: 2, rate: 2 } },
  ];
  const dividend = {
    day: "2026-10-13",
    lines,
    inputs: {
      deckValue: 4800,
      wikiScore: 0,
      posts: 2,
      packsOpened: 0,
      tradesCompleted: 0,
      listingsSold: 0,
      streakDays: 0,
      yieldBoost: 0,
    },
  };

  it("describes the Vault dividend with its stored lines", () => {
    const out = describeRow(
      row({ type: "EARN_PASSIVE", source: "VAULT_DIVIDEND", metadata: dividend })
    );
    expect(out.title).toBe("Vault dividend");
    expect(out.detail).toBe("For 13 October");
    expect(out.lines).toEqual(lines);
  });

  it("reads a dividend whose metadata is a JSON string", () => {
    const out = describeRow(row({ source: "VAULT_DIVIDEND", metadata: JSON.stringify(dividend) }));
    expect(out.lines).toEqual(lines);
  });

  it("still titles a dividend whose metadata is malformed, with no breakdown", () => {
    for (const metadata of [null, "not json", { day: 5 }, JSON.stringify({ lines: "x" })]) {
      const out = describeRow(row({ source: "VAULT_DIVIDEND", metadata }));
      expect(out.title).toBe("Vault dividend");
      expect(out.lines).toBeUndefined();
    }
  });

  it("names the contest and place of a Loreward row and links the Lorewards tab", () => {
    const winner = describeRow(
      row({
        source: "bonus:loreward:e1",
        metadata: JSON.stringify({
          entryId: "e1",
          type: "daily",
          place: "winner",
          date: "2026-10-15",
        }),
      })
    );
    expect(winner).toMatchObject({
      title: "Loreward: daily winner",
      detail: "2026-10-15",
      href: "/vault/achievements?tab=lorewards",
    });
    const runnerUp = describeRow(
      row({
        source: "bonus:loreward:e1:runner-up",
        metadata: { entryId: "e1", type: "weekly", place: "runner-up", date: "2026-W42" },
      })
    );
    expect(runnerUp.title).toBe("Loreward: weekly runner-up");
  });

  it("names the winning page of a Loreward row when the payout recorded it", () => {
    const out = describeRow(
      row({
        source: "bonus:loreward:e1",
        metadata: { type: "daily", place: "winner", date: "2026-10-15", page: "Kir Republic" },
      })
    );
    expect(out).toMatchObject({
      title: "Loreward: daily winner",
      detail: "Kir Republic on 2026-10-15",
    });
    expect(
      describeRow(row({ source: "bonus:loreward:e1", metadata: { type: "daily", page: "Kir" } }))
        .detail
    ).toBe("Kir");
  });

  it("falls back to the source suffix for a Loreward row paid before places were stored", () => {
    expect(
      describeRow(row({ source: "bonus:loreward:e1", metadata: { type: "daily" } })).title
    ).toBe("Loreward: daily winner");
    expect(describeRow(row({ source: "bonus:loreward:e1:runner-up", metadata: null })).title).toBe(
      "Loreward: runner-up"
    );
  });

  it("names an achievement row and links it by key", () => {
    const out = describeRow(
      row({
        source: "bonus:achievement:first_post",
        metadata: JSON.stringify({
          achievementId: "first_post",
          achievementName: "First post",
          achievementTier: "COMMON",
        }),
      })
    );
    expect(out).toMatchObject({
      title: "Achievement: First post",
      href: "/vault/achievements?a=first_post",
    });
  });

  it("derives the achievement from the source when its metadata is missing", () => {
    const out = describeRow(row({ source: "bonus:achievement:wiki_100", metadata: null }));
    expect(out.title).toBe("Achievement: Wiki 100");
    expect(out.href).toBe("/vault/achievements?a=wiki_100");
  });

  it("uses the activity label for every other source", () => {
    expect(describeRow(row({ source: "DAILY_LOGIN_CREDITS" }))).toEqual({ title: "Daily reward" });
    expect(describeRow(row({ source: "P2P_TRADE", credits: -50 }))).toEqual({
      title: "Player trade",
    });
  });
});

describe("rowIconKey", () => {
  it.each([
    ["VAULT_DIVIDEND", "dividend"],
    ["DAILY_DIVIDEND", "dividend"],
    ["DAILY_LOGIN", "daily"],
    ["DAILY_LOGIN_CREDITS", "daily"],
    ["DAILY_LOGIN_CARD", "daily"],
    ["bonus:achievement:first_post", "achievement"],
    ["bonus:loreward:e1", "loreward"],
    ["bonus:loreward:e1:runner-up", "loreward"],
    ["PACK_PURCHASE", "pack"],
    ["Purchase item: Gold frame", "store"],
    ["card_sale_auction", "market"],
    ["card_sale_buyout", "market"],
    ["card_purchase_buyout", "market"],
    ["auction_bid_reserve", "market"],
    ["P2P_TRADE", "trade"],
    ["retired_item_refund:frame", "other"],
    ["exploit_correction:dup", "other"],
    ["Admin Grant: Gold frame", "other"],
    ["SOCIAL_POST", "other"],
  ])("maps %s to %s", (source, key) => {
    expect(rowIconKey(row({ source }))).toBe(key);
  });
});
