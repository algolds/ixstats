/** @jest-environment node */

jest.mock("~/server/db", () => ({
  __esModule: true,
  db: { systemConfig: { findUnique: jest.fn(), upsert: jest.fn() } },
}));
jest.mock("~/lib/discord/admin-dm", () => ({ sendAdminDm: jest.fn(async () => undefined) }));

import { db } from "~/server/db";
import {
  IIWIKI_SWITCH_DEFAULT,
  __resetIiwikiSwitchCacheForTests,
  iiwikiStateAllows,
  parseIiwikiSwitch,
  refreshIiwikiSwitch,
} from "~/lib/wiki-os/iiwiki-switch";
import {
  WikiUnavailableError,
  assertIiwikiAllowed,
  sisterIdForUrl,
} from "~/lib/wiki-os/upstream-guard";
import { describeSwitchChange } from "~/lib/wiki-os/services/iiwiki-admin";

const findUnique = jest.mocked(db.systemConfig.findUnique);

describe("parseIiwikiSwitch", () => {
  it("is all on with no row, a broken row or a row that is not an object", () => {
    for (const raw of [null, "", "not json", "[]", "42"]) {
      expect(parseIiwikiSwitch(raw)).toEqual(IIWIKI_SWITCH_DEFAULT);
    }
  });

  it("keeps what the row says and defaults the rest to on", () => {
    const state = parseIiwikiSwitch(
      JSON.stringify({ enabled: false, features: { country: false, bogus: false } })
    );
    expect(state.enabled).toBe(false);
    expect(state.features.country).toBe(false);
    expect(state.features.reader).toBe(true);
    expect(state.features).not.toHaveProperty("bogus");
  });
});

describe("iiwikiStateAllows", () => {
  const countryOff = {
    enabled: true,
    features: { ...IIWIKI_SWITCH_DEFAULT.features, country: false },
  };

  it("refuses everything when the master switch is off", () => {
    const off = { ...IIWIKI_SWITCH_DEFAULT, enabled: false };
    expect(iiwikiStateAllows(off)).toBe(false);
    expect(iiwikiStateAllows(off, "reader")).toBe(false);
  });

  it("refuses only the feature that is off; untagged calls follow the master switch", () => {
    expect(iiwikiStateAllows(countryOff, "country")).toBe(false);
    expect(iiwikiStateAllows(countryOff, "reader")).toBe(true);
    expect(iiwikiStateAllows(countryOff)).toBe(true);
  });
});

describe("assertIiwikiAllowed", () => {
  beforeEach(() => __resetIiwikiSwitchCacheForTests());

  it("finds IIWiki through its origin, www, its alias, its file host and the development relay", () => {
    expect(sisterIdForUrl("https://iiwiki.com/api.php?action=query")).toBe("iiwiki");
    expect(sisterIdForUrl("https://www.iiwiki.com/wiki/Foo")).toBe("iiwiki");
    expect(sisterIdForUrl("https://iiwiki.us/wiki/Foo")).toBe("iiwiki");
    expect(sisterIdForUrl("https://maps.ixwiki.com/api/mediawiki/iiwiki/api.php?x=1")).toBe(
      "iiwiki"
    );
    expect(sisterIdForUrl("https://althistory.fandom.com/api.php")).not.toBe("iiwiki");
  });

  it("throws a disabled outage for a switched-off feature, and leaves other wikis alone", async () => {
    findUnique.mockResolvedValue({
      value: JSON.stringify({ enabled: true, features: { media: false } }),
    } as never);
    await refreshIiwikiSwitch(true);
    expect(() => assertIiwikiAllowed("https://iiwiki.com/api.php", "media")).toThrow(
      WikiUnavailableError
    );
    try {
      assertIiwikiAllowed("https://iiwiki.com/api.php", "media");
    } catch (error) {
      expect((error as WikiUnavailableError).reason).toBe("disabled");
      expect((error as WikiUnavailableError).message).toBe("IIWiki is switched off for now.");
    }
    expect(() => assertIiwikiAllowed("https://iiwiki.com/api.php", "reader")).not.toThrow();
    expect(() =>
      assertIiwikiAllowed("https://althistory.fandom.com/api.php", "media")
    ).not.toThrow();
  });

  it("keeps the last state when the row cannot be read", async () => {
    findUnique.mockResolvedValue({ value: JSON.stringify({ enabled: false }) } as never);
    await refreshIiwikiSwitch(true);
    findUnique.mockRejectedValue(new Error("db down"));
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    await refreshIiwikiSwitch(true);
    expect(() => assertIiwikiAllowed("https://iiwiki.com/api.php")).toThrow(WikiUnavailableError);
  });
});

describe("describeSwitchChange", () => {
  it("names each switch that moved", () => {
    const after = {
      enabled: false,
      features: { ...IIWIKI_SWITCH_DEFAULT.features, search: false },
    };
    expect(describeSwitchChange(IIWIKI_SWITCH_DEFAULT, after)).toEqual([
      "IIWiki off",
      "search off",
    ]);
    expect(describeSwitchChange(IIWIKI_SWITCH_DEFAULT, IIWIKI_SWITCH_DEFAULT)).toEqual([]);
  });
});
