/** @jest-environment node */
/**
 * Plan 188: pure mappers behind getRealms / getHistory and the authored-work feed.
 */
import { describe, expect, it } from "@jest/globals";
import {
  buildAuthoredArticles,
  buildWikiActivityFeed,
  type LoreAwardRow,
} from "~/server/modules/identity/identity.feed";
import {
  buildHistoryEvents,
  filterByRealm,
  paginateEvents,
  toAwardHistory,
  toRealmMemberships,
} from "~/server/modules/identity/identity.mappers";
import type { IdentityCountry } from "~/server/modules/identity/identity.selects";
import type { IdentityEventPayload } from "~/server/modules/identity/identity.types";

function country(overrides: Partial<IdentityCountry>): IdentityCountry {
  return {
    id: "c1",
    name: "Caphiria",
    slug: "caphiria",
    flag: null,
    coatOfArms: null,
    leader: null,
    wikiPageTitle: null,
    continent: "Sarpedon",
    region: null,
    governmentType: null,
    currentPopulation: 1,
    currentTotalGdp: 2,
    currentGdpPerCapita: 3,
    publicApproval: 61,
    realmId: "default",
    realm: null,
    ...overrides,
  };
}

function award(overrides: Partial<LoreAwardRow>): LoreAwardRow {
  return {
    id: "a1",
    date: "2026-01-02",
    type: "daily",
    winnerUser: "Alex",
    winnerPage: "Winner Page",
    winnerScore: 90,
    runnerUpPage: "Runner Page",
    runnerUpScore: 40,
    ...overrides,
  };
}

describe("toRealmMemberships / filterByRealm", () => {
  it("places default-realm countries in IxEarth and marks featured ids", () => {
    const custom = country({
      id: "c2",
      name: "New Arathia",
      slug: null,
      realmId: "r9",
      realm: { id: "r9", name: "Arathia", slug: "arathia" },
    });
    const [earth, arathia] = toRealmMemberships([country({}), custom], ["c2"], "Sovereign");

    expect(earth).toMatchObject({ id: "default", name: "IxEarth", slug: "ixearth" });
    expect(earth?.isFeatured).toBe(false);
    expect(earth?.country.currentPublicApproval).toBe(61);
    expect(arathia).toMatchObject({ id: "r9", name: "Arathia", slug: "arathia", role: "Sovereign" });
    expect(arathia?.isFeatured).toBe(true);
    expect(arathia?.country.slug).toBe("new_arathia");
  });

  it("filters memberships by realm slug or id, case-insensitively", () => {
    const memberships = toRealmMemberships(
      [country({}), country({ id: "c2", realmId: "r9", realm: { id: "r9", name: "A", slug: "a" } })],
      [],
      "Leader"
    );
    expect(filterByRealm(memberships, "IXEARTH").map((m) => m.country.id)).toEqual(["c1"]);
    expect(filterByRealm(memberships, "r9").map((m) => m.country.id)).toEqual(["c2"]);
    expect(filterByRealm(memberships, "nowhere")).toEqual([]);
  });
});

describe("toAwardHistory", () => {
  it("reports the winner's page and score, else the runner-up's", () => {
    const [won, placed] = toAwardHistory(
      [award({}), award({ id: "a2", winnerUser: "Someone" })],
      "alex"
    );
    expect(won).toMatchObject({ role: "winner", page: "Winner Page", score: 90 });
    expect(placed).toMatchObject({ role: "runner-up", page: "Runner Page", score: 40 });
  });
});

describe("buildAuthoredArticles", () => {
  it("dedupes MediaWiki pages already listed natively and sorts newest first", () => {
    const articles = buildAuthoredArticles(
      [
        {
          id: "n1",
          slug: "",
          title: "Treaty of Oakhaven",
          summary: null,
          createdAt: new Date("2025-01-01"),
          updatedAt: new Date("2025-01-01"),
        },
      ],
      [
        { title: "treaty of oakhaven", createdAt: "2026-01-01", byteSize: 10 },
        { title: "Imperial Senate", createdAt: "2026-02-01", byteSize: 2048 },
      ]
    );
    expect(articles.map((a) => a.title)).toEqual(["Imperial Senate", "Treaty of Oakhaven"]);
    expect(articles[1]).toMatchObject({ slug: "treaty_of_oakhaven", summary: "WikiOS Canonical Article" });
  });
});

describe("buildWikiActivityFeed + buildHistoryEvents", () => {
  const feed = buildWikiActivityFeed(
    [],
    [
      {
        rev_id: 7,
        page_title: "Imperial Senate",
        rev_timestamp: "2026-03-01T00:00:00Z",
        rev_len: 120,
        rev_comment: "",
        rev_minor_edit: 0,
        is_new: true,
      },
    ],
    [],
    [award({ date: "2026-02-01" })],
    "Alex"
  );

  it("merges wiki sources newest first with typed entries", () => {
    expect(feed.map((i) => i.type)).toEqual(["publish", "laurel"]);
    expect(feed[1]?.summary).toBe("Lore of the Day (Winner · +90 pts)");
  });

  it("builds the History stream with directives and the join event, newest first", () => {
    const events = buildHistoryEvents({
      identityId: "u1",
      handle: "alex",
      feed,
      directives: [
        {
          id: "d1",
          goal: "Balance the budget",
          tier: "measured",
          category: "",
          status: "active",
          countryId: "c1",
          createdAt: new Date("2026-04-01"),
        },
      ],
      countryNames: new Map([["c1", "Caphiria"]]),
      joinedAt: new Date("2024-05-01"),
    });

    expect(events.map((e) => e.type)).toEqual([
      "mycountry.directive_enacted",
      "wikios.article_published",
      "wikios.article_revised",
      "realm.joined",
    ]);
    expect(events[0]).toMatchObject({
      countryName: "Caphiria",
      description: "Category: Governance · Tier: measured · Status: active",
    });
    expect(events[1]?.title).toBe('Published "Imperial Senate"');
    expect(events[3]).toMatchObject({ identityId: "u1", objectUrl: "/@alex" });
  });
});

describe("paginateEvents", () => {
  const events = ["e1", "e2", "e3", "e4", "e5"].map(
    (id): IdentityEventPayload => ({
      id,
      identityId: "u1",
      system: "wikios",
      type: "wikios.article_revised",
      title: id,
      timestamp: new Date(0),
    })
  );

  it("pages by the last shown event id", () => {
    const first = paginateEvents(events, 2, null);
    expect(first.items.map((e) => e.id)).toEqual(["e1", "e2"]);
    expect(first.nextCursor).toBe("e2");

    const last = paginateEvents(events, 2, "e4");
    expect(last.items.map((e) => e.id)).toEqual(["e5"]);
    expect(last.nextCursor).toBeNull();
  });

  it("restarts from the top on an unknown cursor", () => {
    expect(paginateEvents(events, 2, "gone").items.map((e) => e.id)).toEqual(["e1", "e2"]);
  });
});
