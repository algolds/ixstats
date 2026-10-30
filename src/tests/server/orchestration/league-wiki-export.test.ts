/** @jest-environment node */
/**
 * "Publish to wiki" (MyLeague): the league's standings written into the marked block of its IxWiki article, as the
 * signed-in owner, through the WikiOS save path. The save is based on the head revision read before the text, so an
 * edit that lands in between is a conflict, never overwritten.
 */
const mockAssertCanEdit = jest.fn();
const mockSaveOrConflict = jest.fn();
jest.mock("~/lib/wiki-os/services/edit-service", () => ({
  __esModule: true,
  assertCanEditArticle: (...args: unknown[]) => mockAssertCanEdit(...args),
  saveOrConflict: (...args: unknown[]) => mockSaveOrConflict(...args),
}));
const mockHead = jest.fn();
jest.mock("~/lib/wiki-os/core/edit-conflict", () => ({
  __esModule: true,
  getHeadRevisionRefs: (...args: unknown[]) => mockHead(...args),
}));
const mockWikitext = jest.fn();
jest.mock("~/lib/wiki-os/adapters/mediawiki/article-store", () => ({
  __esModule: true,
  getArticleWikitextShadow: (...args: unknown[]) => mockWikitext(...args),
}));
const mockAssertVisible = jest.fn();
jest.mock("~/lib/wiki-os/permissions", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/wiki-os/permissions"),
  assertTitleVisible: (...args: unknown[]) => mockAssertVisible(...args),
}));

import { TRPCError } from "@trpc/server";
import { publishLeagueStandings as publishStandings } from "~/server/orchestration/league-wiki-export";
import { STANDINGS_END, STANDINGS_START } from "~/lib/sports/standings-wikitext";

const TITLE = "Varro League";

function standing(teamName: string, points: number, wikiSlug: string | null = null) {
  return {
    id: `st-${teamName}`,
    teamId: `t-${teamName}`,
    wins: points,
    draws: 0,
    losses: 1,
    points,
    pointsFor: points * 2,
    pointsAgainst: 3,
    team: { id: `t-${teamName}`, name: teamName, wikiSlug },
  };
}

function makeCtx(league: Record<string, unknown> | null = {}) {
  const findUnique = jest.fn().mockResolvedValue(
    league && {
      id: "lg1",
      name: TITLE,
      wikiSlug: "Varro_League",
      seasons: [{ id: "s2", seasonNumber: 2, status: "in_progress" }],
      ...league,
    }
  );
  const findMany = jest
    .fn()
    .mockResolvedValue([standing("Varro FC", 9, "FC_Varro"), standing("Lest", 6)]);
  return {
    db: { sportLeague: { findUnique }, sportStanding: { findMany } },
    user: { id: "u1", handle: "alex" },
    auth: { userId: "clerk_u1" },
  };
}

/** The orchestration with a context whose db mocks only the reads it makes. */
function publishLeagueStandings(ctx: ReturnType<typeof makeCtx>, leagueId: string) {
  return publishStandings(ctx as never, leagueId);
}

beforeEach(() => {
  mockAssertCanEdit.mockReset().mockResolvedValue(undefined);
  mockSaveOrConflict
    .mockReset()
    .mockResolvedValue({ success: true, revisionId: "rev-8", nullEdit: false });
  mockHead.mockReset().mockResolvedValue({ revisionRef: "rev-7", revisionRefs: ["rev-7", "107"] });
  mockWikitext.mockReset().mockResolvedValue({ wikitext: "Intro.\n\n[[Category:Leagues]]" });
  mockAssertVisible.mockReset().mockResolvedValue(undefined);
});

function savedText(): string {
  return (mockSaveOrConflict.mock.calls[0]?.[1] as { wikitext: string }).wikitext;
}

describe("publishLeagueStandings", () => {
  it("saves the article with the standings block on top of the head revision it read", async () => {
    const ctx = makeCtx();

    await expect(publishLeagueStandings(ctx, "lg1")).resolves.toEqual({
      success: true,
      revisionRef: "rev-8",
    });

    expect(mockSaveOrConflict).toHaveBeenCalledTimes(1);
    const [saveCtx, save] = mockSaveOrConflict.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(saveCtx).toBe(ctx);
    expect(save).toMatchObject({
      title: TITLE,
      summary: "Standings from IxStates (Varro League)",
      minor: false,
      expectedHeadRef: "rev-7",
    });
    const text = savedText();
    expect(text.startsWith("Intro.\n\n[[Category:Leagues]]\n\n== Standings ==\n")).toBe(true);
    expect(text).toContain(STANDINGS_START);
    expect(text).toContain(STANDINGS_END);
    expect(text).toContain("| 1 || [[:FC Varro|Varro FC]] ||");
    expect(text).toContain("| 2 || Lest ||");
  });

  it("checks edit rights and visibility on the canonical title of the league's wiki slug", async () => {
    const ctx = makeCtx();

    await publishLeagueStandings(ctx, "lg1");

    expect(mockAssertCanEdit).toHaveBeenCalledWith(ctx, TITLE);
    expect(mockAssertVisible).toHaveBeenCalledWith(ctx, TITLE, "ixwiki");
    expect(mockHead).toHaveBeenCalledWith(TITLE);
    expect(mockWikitext).toHaveBeenCalledWith(TITLE, "ixwiki", { includeArchived: true });
  });

  it("reads the head revision before the text", async () => {
    await publishLeagueStandings(makeCtx(), "lg1");

    expect(mockHead.mock.invocationCallOrder[0]).toBeLessThan(
      mockWikitext.mock.invocationCallOrder[0]!
    );
  });

  it("replaces only the marked block of an article that has one", async () => {
    const before = "Intro.\n== Standings ==\n";
    const after = "\nHand-written notes.\n";
    mockWikitext.mockResolvedValue({
      wikitext: `${before}${STANDINGS_START}\nold\n${STANDINGS_END}${after}`,
    });

    await publishLeagueStandings(makeCtx(), "lg1");

    const text = savedText();
    expect(text.startsWith(`${before}${STANDINGS_START}\n`)).toBe(true);
    expect(text.endsWith(`${STANDINGS_END}${after}`)).toBe(true);
    expect(text).not.toContain("\nold\n");
  });

  it("answers a save that hit an edit conflict with { success: false, conflict: true }", async () => {
    mockSaveOrConflict.mockResolvedValue({
      success: false,
      editConflict: true,
      currentWikitext: "someone else's text",
      currentRevisionRef: "rev-9",
    });

    await expect(publishLeagueStandings(makeCtx(), "lg1")).resolves.toEqual({
      success: false,
      conflict: true,
    });
  });

  it("gives a caller without edit rights the assertCanEditArticle error, and reads and saves nothing", async () => {
    const refusal = new TRPCError({ code: "FORBIDDEN", message: "protectedpage: no" });
    mockAssertCanEdit.mockRejectedValue(refusal);

    await expect(publishLeagueStandings(makeCtx(), "lg1")).rejects.toBe(refusal);
    expect(mockAssertVisible).not.toHaveBeenCalled();
    expect(mockHead).not.toHaveBeenCalled();
    expect(mockWikitext).not.toHaveBeenCalled();
    expect(mockSaveOrConflict).not.toHaveBeenCalled();
  });

  it("refuses to save without a head revision to base the save on", async () => {
    mockHead.mockResolvedValue(null);

    await expect(publishLeagueStandings(makeCtx(), "lg1")).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(mockSaveOrConflict).not.toHaveBeenCalled();
  });

  it("refuses to save when the head revision cannot be read", async () => {
    mockHead.mockRejectedValue(new Error("shadow store down"));

    await expect(publishLeagueStandings(makeCtx(), "lg1")).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(mockSaveOrConflict).not.toHaveBeenCalled();
  });

  it("refuses to save over an article whose text it could not read", async () => {
    mockWikitext.mockResolvedValue(null);

    await expect(publishLeagueStandings(makeCtx(), "lg1")).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(mockSaveOrConflict).not.toHaveBeenCalled();
  });

  it("refuses a redirect page rather than write the standings onto it", async () => {
    mockWikitext.mockResolvedValue({ wikitext: "#REDIRECT [[Varro Premier League]]" });

    await expect(publishLeagueStandings(makeCtx(), "lg1")).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("Varro Premier League"),
    });
    expect(mockSaveOrConflict).not.toHaveBeenCalled();
  });

  it("refuses an article whose start marker has no end marker", async () => {
    mockWikitext.mockResolvedValue({ wikitext: `Intro\n${STANDINGS_START}\nnotes` });

    await expect(publishLeagueStandings(makeCtx(), "lg1")).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(mockSaveOrConflict).not.toHaveBeenCalled();
  });

  it("refuses a league with no wiki article", async () => {
    await expect(publishLeagueStandings(makeCtx({ wikiSlug: null }), "lg1")).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(mockAssertCanEdit).not.toHaveBeenCalled();
  });

  it("refuses a league that does not exist", async () => {
    await expect(publishLeagueStandings(makeCtx(null), "lg1")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("refuses a league with no standings yet", async () => {
    const ctx = makeCtx({ seasons: [] });

    await expect(publishLeagueStandings(ctx, "lg1")).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(mockSaveOrConflict).not.toHaveBeenCalled();
  });

  it("publishes the season the league page shows: the latest completed one when none is in progress", async () => {
    const ctx = makeCtx({
      seasons: [
        { id: "s3", seasonNumber: 3, status: "upcoming" },
        { id: "s2", seasonNumber: 2, status: "completed" },
      ],
    });

    await publishLeagueStandings(ctx, "lg1");

    expect(ctx.db.sportStanding.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { seasonId: "s2" } })
    );
    expect(savedText()).toContain("season 2");
  });
});
