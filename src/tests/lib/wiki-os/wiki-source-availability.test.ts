/** @jest-environment node */
/**
 * The wiki pickers' one rule set: IxWiki ("Wiki") first, the sister wikis after it; the IIWiki switch and breaker
 * mapped per feature to on, switched off or resting; a wiki that cannot answer listed but disabled with a plain
 * reason and never the selected one; an outage's own words shown instead of a generic failure.
 */
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: { systemConfig: { findUnique: jest.fn() } },
}));
jest.mock("~/lib/discord/admin-dm", () => ({ sendAdminDm: jest.fn(async () => undefined) }));

import { db } from "~/server/db";
import {
  IIWIKI_SWITCH_DEFAULT,
  __resetIiwikiSwitchCacheForTests,
  type IiwikiSwitchState,
} from "~/lib/wiki-os/iiwiki-switch";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosIiwikiRouter } from "~/server/api/routers/wikios/iiwiki";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import {
  WIKI_SOURCE_IDS,
  iiwikiAvailability,
  selectedWikiSource,
  wikiReadErrorText,
  wikiSourceLabel,
  wikiSourceOptions,
  type IiwikiAvailability,
} from "~/lib/wiki-os/wiki-source-availability";

const CLOSED = { state: "closed", retryInMs: 0 } as const;
const allOn = iiwikiAvailability(IIWIKI_SWITCH_DEFAULT, CLOSED);

function stateWith(changes: Partial<IiwikiSwitchState["features"]>, enabled = true) {
  return { enabled, features: { ...IIWIKI_SWITCH_DEFAULT.features, ...changes } };
}

describe("wiki sources", () => {
  it("lists Wiki first, then the sister wikis by their own names", () => {
    expect(WIKI_SOURCE_IDS[0]).toBe("ixwiki");
    expect(WIKI_SOURCE_IDS).toEqual(expect.arrayContaining(["iiwiki", "althistory"]));
    expect(WIKI_SOURCE_IDS.map(wikiSourceLabel)).toEqual(
      expect.arrayContaining(["Wiki", "IIWiki", "AltHistory Wiki"])
    );
    expect(wikiSourceLabel("ixwiki")).toBe("Wiki");
  });
});

describe("iiwikiAvailability", () => {
  it("says every feature answers when the switch is on and the breaker closed", () => {
    expect(Object.values(allOn).every((reason) => reason === null)).toBe(true);
    expect(allOn).toHaveProperty("imports", null);
  });

  it("says a feature switched off is disabled, and leaves the others on", () => {
    const availability = iiwikiAvailability(stateWith({ imports: false }), CLOSED);
    expect(availability.imports).toBe("disabled");
    expect(availability.country).toBeNull();
  });

  it("says every feature is disabled under the master switch, whatever the breaker does", () => {
    const availability = iiwikiAvailability(stateWith({}, false), { state: "open", retryInMs: 5 });
    expect(new Set(Object.values(availability))).toEqual(new Set(["disabled"]));
  });

  it("says resting while the breaker rests or probes, and on again once its rest is over", () => {
    expect(
      iiwikiAvailability(IIWIKI_SWITCH_DEFAULT, { state: "open", retryInMs: 30_000 }).country
    ).toBe("resting");
    expect(
      iiwikiAvailability(IIWIKI_SWITCH_DEFAULT, { state: "probing", retryInMs: 0 }).country
    ).toBe("resting");
    expect(
      iiwikiAvailability(IIWIKI_SWITCH_DEFAULT, { state: "open", retryInMs: 0 }).country
    ).toBeNull();
  });
});

describe("wikiSourceOptions and selectedWikiSource", () => {
  const off: IiwikiAvailability = { ...allOn, imports: "disabled" };

  it("disables IIWiki with a short reason when its feature is switched off, and only IIWiki", () => {
    const options = wikiSourceOptions(WIKI_SOURCE_IDS, off, "imports");
    const iiwiki = options.find((option) => option.value === "iiwiki");
    expect(iiwiki).toMatchObject({ disabled: true, reason: "IIWiki is switched off for now." });
    expect(options.filter((option) => option.disabled)).toHaveLength(1);
    expect(options[0]).toMatchObject({ value: "ixwiki", label: "Wiki", disabled: false });
  });

  it("explains a resting breaker in its own words", () => {
    const options = wikiSourceOptions(WIKI_SOURCE_IDS, { ...allOn, country: "resting" }, "country");
    expect(options.find((option) => option.value === "iiwiki")?.reason).toBe(
      "IIWiki could not be reached just now."
    );
  });

  it("offers every wiki until the availability has loaded", () => {
    expect(wikiSourceOptions(WIKI_SOURCE_IDS, undefined, "imports").some((o) => o.disabled)).toBe(
      false
    );
  });

  it("selects Wiki by default and never a disabled wiki, even one picked before it went off", () => {
    const options = wikiSourceOptions(WIKI_SOURCE_IDS, off, "imports");
    expect(selectedWikiSource(null, options)).toBe("ixwiki");
    expect(selectedWikiSource("iiwiki", options)).toBe("ixwiki");
    expect(selectedWikiSource("althistory", options)).toBe("althistory");
    expect(selectedWikiSource("iiwiki", wikiSourceOptions(WIKI_SOURCE_IDS, allOn, "imports"))).toBe(
      "iiwiki"
    );
  });

  it("keeps a narrowed list's first usable wiki selected (a realm map that reads IIWiki only)", () => {
    const only = wikiSourceOptions(["iiwiki"], off, "imports");
    expect(selectedWikiSource(null, only)).toBe("iiwiki");
    expect(selectedWikiSource(null, wikiSourceOptions(["althistory"], off, "imports"))).toBe(
      "althistory"
    );
  });
});

describe("wikiReadErrorText", () => {
  it("shows an outage's own words and the fallback for anything else", () => {
    const off = {
      message: "IIWiki is switched off for now.",
      data: { code: "SERVICE_UNAVAILABLE" },
    };
    expect(wikiReadErrorText(off, "Try again.")).toBe("IIWiki is switched off for now.");
    expect(
      wikiReadErrorText(
        { message: "IIWiki is switched off for now.", data: { code: "PRECONDITION_FAILED" } },
        "x"
      )
    ).toBe("IIWiki is switched off for now.");
    expect(
      wikiReadErrorText({ message: "Boom", data: { code: "INTERNAL_SERVER_ERROR" } }, "Try again.")
    ).toBe("Try again.");
    expect(wikiReadErrorText(null, "Try again.")).toBe("Try again.");
  });
});

describe("wikios.iiwikiAvailability", () => {
  const findUnique = jest.mocked(db.systemConfig.findUnique);
  const anonymous = () =>
    createCallerFactory(wikiosIiwikiRouter)(
      createMockRouterContext({ auth: null, user: null }) as never
    );

  beforeEach(() => {
    __resetIiwikiSwitchCacheForTests();
    findUnique.mockReset();
  });

  it("tells a signed-out visitor which features IIWiki answers for, and nothing else", async () => {
    findUnique.mockResolvedValue({
      value: JSON.stringify({ enabled: true, features: { imports: false } }),
    } as never);

    const availability = await anonymous().iiwikiAvailability();

    expect(availability.imports).toBe("disabled");
    expect(availability.country).toBeNull();
    expect(Object.values(availability).every((v) => v === null || typeof v === "string")).toBe(
      true
    );
  });

  it("keeps the admin status behind the admin check", async () => {
    await expect(anonymous().getIiwikiStatus()).rejects.toThrow();
  });
});
