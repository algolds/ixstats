/** @jest-environment node */
import {
  banSourceRef,
  MIGRATION_ACTOR,
  planBoardBanMigration,
  summarizeBanMigration,
  type BoardBanRow,
  type ClaimRow,
  type CountryRow,
} from "../../../scripts/migrations/board-bans-to-forum-plan";

const day = (n: number) => new Date(Date.UTC(2026, 0, n, 12));
const NOW = day(20);

function ban(overrides: Partial<BoardBanRow> = {}): BoardBanRow {
  return {
    id: "bb-1",
    realmId: "realm-1",
    countryId: "country-1",
    kind: "ban",
    reason: "Spam",
    until: null,
    createdBy: "clerk-mod",
    createdAt: day(10),
    ...overrides,
  };
}

const claim = (userId: string, reviewed: number, overrides: Partial<ClaimRow> = {}): ClaimRow => ({
  realmId: "realm-1",
  userId,
  countryId: "country-1",
  reviewedAt: day(reviewed),
  ...overrides,
});

const owned = (ownerUserId: string | null, realmId = "realm-1"): Map<string, CountryRow> =>
  new Map([["country-1", { realmId, ownerUserId }]]);

function plan(
  rows: BoardBanRow[],
  opts: {
    claims?: ClaimRow[];
    countries?: Map<string, CountryRow>;
    migrated?: string[];
    users?: Map<string, string>;
  } = {}
) {
  return planBoardBanMigration({
    rows,
    claims: opts.claims ?? [],
    countries: opts.countries ?? owned("user-owner"),
    userIdByClerk: opts.users ?? new Map([["clerk-mod", "user-mod"]]),
    migrated: new Set(opts.migrated ?? []),
    now: NOW,
  });
}

const holdersOf = (result: ReturnType<typeof plan>) => result.bans.map((b) => b.userId);

describe("banSourceRef", () => {
  it("names the board ban and the bound player", () => {
    expect(banSourceRef("bb-1", "user-1")).toBe("realm_board_ban:bb-1:user-1");
  });
});

describe("planBoardBanMigration: expiry", () => {
  it("skips a row that ended at or before now and counts it expired", () => {
    const result = plan([ban({ id: "a", until: NOW }), ban({ id: "b", until: day(19) })]);
    expect(result.bans).toEqual([]);
    expect(result.skipped.expired).toBe(2);
  });

  it("keeps a row that ends later or never, with expiresAt = until", () => {
    const result = plan([ban({ id: "a", until: day(21) }), ban({ id: "b", until: null })]);
    expect(result.bans.map((b) => b.expiresAt)).toEqual([day(21), null]);
    expect(result.skipped.expired).toBe(0);
  });
});

describe("planBoardBanMigration: who a nation-bound row binds (restrictionHolders)", () => {
  it("binds the current owner of a nation assigned without claims", () => {
    expect(holdersOf(plan([ban()]))).toEqual(["user-owner"]);
  });

  it("binds the owner who claimed the nation before the ban", () => {
    const result = plan([ban()], { claims: [claim("user-owner", 5)] });
    expect(holdersOf(result)).toEqual(["user-owner"]);
  });

  it("binds the earlier holder only when someone else claimed the nation after the ban", () => {
    const result = plan([ban()], {
      claims: [claim("user-a", 5), claim("user-b", 15)],
      countries: owned("user-b"),
    });
    expect(holdersOf(result)).toEqual(["user-a"]);
  });

  it("binds a former holder who abandoned the nation", () => {
    const result = plan([ban()], { claims: [claim("user-a", 5)], countries: owned(null) });
    expect(holdersOf(result)).toEqual(["user-a"]);
  });

  it("binds the latest claimant before the ban, never an older one", () => {
    const result = plan([ban()], {
      claims: [claim("user-old", 2), claim("user-a", 5)],
      countries: owned(null),
    });
    expect(holdersOf(result)).toEqual(["user-a"]);
  });

  it("plans one ban per holder: the holder then and an owner assigned since without a claim", () => {
    const result = plan([ban()], { claims: [claim("user-a", 5)], countries: owned("user-c") });
    expect(holdersOf(result)).toEqual(["user-a", "user-c"]);
    expect(result.bans.map((b) => b.sourceRef)).toEqual([
      "realm_board_ban:bb-1:user-a",
      "realm_board_ban:bb-1:user-c",
    ]);
  });

  it("counts a row nobody holds as noHolder", () => {
    const result = plan([ban()], { countries: owned(null) });
    expect(result.bans).toEqual([]);
    expect(result.skipped.noHolder).toBe(1);
  });

  it("counts a row whose nation is gone as noHolder", () => {
    const result = plan([ban()], { countries: new Map() });
    expect(result.skipped.noHolder).toBe(1);
  });

  it("ignores claims made in another realm, as the board did", () => {
    const result = plan([ban()], {
      claims: [claim("user-elsewhere", 5, { realmId: "realm-2" })],
      countries: owned(null),
    });
    expect(result.skipped.noHolder).toBe(1);
  });

  it("ignores the owner of a nation that has left the ban's realm, as the board did", () => {
    const result = plan([ban()], { countries: owned("user-owner", "realm-2") });
    expect(result.skipped.noHolder).toBe(1);
  });

  it("ignores claims on other nations", () => {
    const result = plan([ban()], {
      claims: [claim("user-x", 5, { countryId: "country-2" })],
    });
    expect(holdersOf(result)).toEqual(["user-owner"]);
  });
});

describe("planBoardBanMigration: the planned ban", () => {
  it("is a manual realm-scope ban keeping the row's reason, creator, dates and kind", () => {
    const result = plan([ban({ until: day(30) })]);
    expect(result.bans).toEqual([
      {
        sourceRef: "realm_board_ban:bb-1:user-owner",
        userId: "user-owner",
        scope: "realm",
        scopeId: "realm-1",
        reason: "Spam",
        issuedBy: "user-mod",
        expiresAt: day(30),
        auto: false,
        createdAt: day(10),
        detail: { realmBoardBanId: "bb-1", kind: "ban", countryId: "country-1" },
      },
    ]);
  });

  it("turns a mute into a ban too (M6), recording the kind", () => {
    const [planned] = plan([ban({ kind: "mute" })]).bans;
    expect(planned?.detail.kind).toBe("mute");
    expect(planned?.scope).toBe("realm");
  });

  it("falls back to a reason naming the kind when the row has none or a blank one", () => {
    const result = plan([
      ban({ id: "a", reason: null, kind: "mute" }),
      ban({ id: "b", reason: "  " }),
    ]);
    expect(result.bans.map((b) => b.reason)).toEqual([
      "Migrated from the realm board (mute)",
      "Migrated from the realm board (ban)",
    ]);
  });

  it("trims the reason and clips it to the forum's 1000 characters, counting the clip", () => {
    const long = "é".repeat(1200);
    const result = plan([ban({ id: "a", reason: "  Spam  " }), ban({ id: "b", reason: long })]);
    expect(result.bans[0]?.reason).toBe("Spam");
    expect(result.bans[1]?.reason).toBe("é".repeat(1000));
    expect(result.reasonClipped).toBe(1);
  });

  it("never splits a character outside the basic plane when clipping", () => {
    const [planned] = plan([ban({ reason: "😀".repeat(1001) })]).bans;
    expect(Array.from(planned?.reason ?? "")).toHaveLength(1000);
  });

  it("issues as the system when the creator has no User row, counting each such ban", () => {
    const result = plan([ban()], {
      claims: [claim("user-a", 5)],
      countries: owned("user-c"),
      users: new Map(),
    });
    expect(result.bans.map((b) => b.issuedBy)).toEqual([MIGRATION_ACTOR, MIGRATION_ACTOR]);
    expect(MIGRATION_ACTOR).toBe("system");
    expect(result.issuerUnknown).toBe(2);
  });
});

describe("planBoardBanMigration: idempotency", () => {
  it("skips a holder already migrated and counts it, planning the rest", () => {
    const result = plan([ban()], {
      claims: [claim("user-a", 5)],
      countries: owned("user-c"),
      migrated: ["realm_board_ban:bb-1:user-a"],
    });
    expect(holdersOf(result)).toEqual(["user-c"]);
    expect(result.skipped.alreadyMigrated).toBe(1);
  });

  it("plans nothing on a rerun", () => {
    const first = plan([ban(), ban({ id: "bb-2", countryId: "country-1" })]);
    const rerun = plan([ban(), ban({ id: "bb-2", countryId: "country-1" })], {
      migrated: first.bans.map((b) => b.sourceRef),
    });
    expect(rerun.bans).toEqual([]);
    expect(rerun.skipped.alreadyMigrated).toBe(2);
  });
});

describe("summarizeBanMigration", () => {
  it("prints one line per realm, then the totals", () => {
    const eurth = {
      realm: "Eurth",
      rows: 3,
      plan: plan([
        ban({ id: "a" }),
        ban({ id: "b", until: day(1) }),
        ban({ id: "c", createdBy: "clerk-x" }),
      ]),
    };
    const ixworld = {
      realm: "IxWorld",
      rows: 1,
      plan: plan([ban()], { countries: owned(null) }),
    };
    expect(summarizeBanMigration([eurth, ixworld])).toEqual([
      "Eurth: 3 board bans, 2 forum bans to create; skipped 1 expired, 0 no holder, 0 already migrated; 1 issued by the system, 0 reasons clipped",
      "IxWorld: 1 board ban, 0 forum bans to create; skipped 0 expired, 1 no holder, 0 already migrated; 0 issued by the system, 0 reasons clipped",
      "Total: 4 board bans in 2 realms, 2 forum bans to create; skipped 1 expired, 1 no holder, 0 already migrated; 1 issued by the system, 0 reasons clipped",
    ]);
  });

  it("names one realm and one forum ban in the singular", () => {
    const only = { realm: "Eurth", rows: 1, plan: plan([ban()]) };
    expect(summarizeBanMigration([only]).at(-1)).toBe(
      "Total: 1 board ban in 1 realm, 1 forum ban to create; skipped 0 expired, 0 no holder, 0 already migrated; 0 issued by the system, 0 reasons clipped"
    );
  });
});
