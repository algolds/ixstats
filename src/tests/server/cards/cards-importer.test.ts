/** @jest-environment node */
/**
 * The importer (cards refresh spec §2.1, §2.4): every import lands PENDING in its home realm, with its art licence
 * recorded; NC/ND art is blocked; a page with a card or a realm's nation page is skipped.
 */
jest.mock("~/lib/cards/lore-card-generator", () => ({
  wikiLoreCardGenerator: { generateCard: jest.fn() },
}));
jest.mock("~/server/modules/cards/cards.art-licence", () => ({
  captureArtLicence: jest.fn(),
  wikiQueryFor: jest.fn(),
}));

import { Prisma } from "@prisma/client";
import { wikiLoreCardGenerator } from "~/lib/cards/lore-card-generator";
import { ArticleRejected, type LoreCardCandidate } from "~/lib/cards/lore-card-candidate";
import { captureArtLicence, wikiQueryFor } from "~/server/modules/cards/cards.art-licence";
import { DEFAULT_RARITY_THRESHOLDS } from "~/lib/cards/rarity-engine";
import { DiscoveryStopped } from "~/lib/realms/sources/wiki-discovery-client";
import { TRPCError } from "@trpc/server";
import {
  cardedTitleKeys,
  oneOffImportContext,
  resolveImportRealm,
  stageArticleCard,
  stageCommonsFile,
  stageForAdmin,
  type ImportContext,
} from "~/server/modules/cards/cards.importer";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const generateCard = jest.mocked(wikiLoreCardGenerator.generateCard);
const capture = jest.mocked(captureArtLicence);
const context: ImportContext = { query: jest.fn(), thresholds: DEFAULT_RARITY_THRESHOLDS.iiwiki };

const candidate = (overrides: Partial<LoreCardCandidate> = {}): LoreCardCandidate => ({
  title: "Union Assembly",
  description: "The Union Assembly is the legislature.",
  fullExcerpt: "The Union Assembly is the legislature of the Union.",
  artwork: "https://iiwiki.com/images/a/ab/Assembly.png",
  imageFile: "Assembly.png",
  wikiSource: "iiwiki",
  wikiArticleTitle: "Union Assembly",
  wikiUrl: "/wiki/Union_Assembly?source=iiwiki",
  category: "GOVERNMENT",
  signals: {
    length: 4000,
    referenceCount: 4,
    inboundLinks: 10,
    categoryCount: 4,
    hasInfobox: true,
    isFeatured: false,
  },
  qualityScore: 45,
  ...overrides,
});

const openLicence = {
  fileTitle: "File:Assembly.png",
  fileUrl: "https://iiwiki.com/images/a/ab/Assembly.png",
  descriptionUrl: "https://iiwiki.com/wiki/File:Assembly.png",
  licence: "CC BY-SA 4.0",
  licenceUrl: null,
  artist: "Elm",
  attribution: "Assembly.png by Elm, CC BY-SA 4.0, via IIWiki",
  status: "OPEN" as const,
};

function makeDb(carded: string[] = []) {
  const db = createMockPrisma({
    $queryRaw: jest.fn().mockResolvedValue(carded.map((key) => ({ key }))),
  });
  db.card.create.mockResolvedValue({ id: "card_new", rarity: "RARE" });
  return db;
}

const input = (title: string) => ({ title, requestedBy: null, jobId: null });
const createdData = (db: ReturnType<typeof makeDb>) => db.card.create.mock.calls[0]![0].data;

beforeEach(() => {
  jest.clearAllMocks();
  generateCard.mockResolvedValue(candidate());
  capture.mockResolvedValue(openLicence);
});

describe("stageArticleCard", () => {
  it("stages a PENDING card in the system realm, with its licence and the source's rarity", async () => {
    const db = makeDb();
    const outcome = await stageArticleCard(
      db as never,
      "iiwiki",
      { title: "Union_Assembly", requestedBy: "admin_db", jobId: "job_1" },
      context
    );
    expect(outcome).toEqual({
      status: "STAGED",
      cardId: "card_new",
      rarity: "RARE",
      licence: "CC BY-SA 4.0",
    });
    expect(capture).toHaveBeenCalledWith(context.query, "iiwiki", "Assembly.png");
    const data = createdData(db);
    expect(data).toMatchObject({
      title: "Union Assembly",
      description: "The Union Assembly is the legislature.",
      artwork: candidate().artwork,
      cardType: "LORE",
      category: "GOVERNMENT",
      rarity: "RARE", // score 45 against 21/41/61/81/96
      marketValue: 100, // the Rare floor
      season: 1,
      wikiSource: "iiwiki",
      wikiArticleTitle: "Union Assembly",
      wikiExcerpt: candidate().fullExcerpt,
      realmId: "iiwiki",
      reviewState: "PENDING",
      artworkSource: "WIKI_FETCHED",
      artworkCredit: openLicence.attribution,
      metadata: {
        wikiUrl: candidate().wikiUrl,
        category: "GOVERNMENT",
        qualityScore: 45,
        fullExcerpt: candidate().fullExcerpt,
      },
      artLicence: {
        create: {
          wiki: "iiwiki",
          importedBy: "admin_db",
          importJobId: "job_1",
          fileTitle: openLicence.fileTitle,
          fileUrl: openLicence.fileUrl,
          descriptionUrl: openLicence.descriptionUrl,
          licence: "CC BY-SA 4.0",
          licenceUrl: null,
          status: "OPEN",
          artist: "Elm",
          attribution: openLicence.attribution,
        },
      },
    });
    // A pending card has no reviewer, and an import never sets a run size.
    expect(data).not.toHaveProperty("reviewedBy");
    expect(data).not.toHaveProperty("totalSupply");
    expect(db.card.create.mock.calls[0]![0].select).toEqual({ id: true, rarity: true });
  });

  it("reads the article in the turns of the run's client when the context has one", async () => {
    const db = makeDb();
    const pace = jest.fn();
    await stageArticleCard(db as never, "iiwiki", input("Union Assembly"), { ...context, pace });
    expect(generateCard).toHaveBeenCalledWith(
      "Union Assembly",
      "iiwiki",
      expect.objectContaining({ pace })
    );
  });

  it("stores the canonical title, and asks for an existing card by its key", async () => {
    const db = makeDb();
    await stageArticleCard(db as never, "iiwiki", input("battle_of_Kiro"), context);
    expect(generateCard).toHaveBeenCalledWith("Battle of Kiro", "iiwiki", {
      requireImage: undefined,
      minLength: undefined,
    });
    expect(createdData(db).wikiArticleTitle).toBe("Battle of Kiro");
    const [strings, source, keys] = db.$queryRaw.mock.calls[0]! as [
      TemplateStringsArray,
      string,
      { values: string[] },
    ];
    expect(strings.join("?")).toContain(`COALESCE("wikiSource", 'ixwiki') = ?`);
    expect(strings.join("?")).toContain(`"cardType" = 'LORE'`);
    expect(strings.join("?")).toContain(`lower("wikiArticleTitle") IN (?)`);
    expect(source).toBe("iiwiki");
    expect(keys.values).toEqual(["battle of kiro"]);
  });

  it("records the article's credit with the card", async () => {
    const db = makeDb();
    generateCard.mockResolvedValue(
      candidate({ authorInfo: { creator: "Kir", displayAuthor: "Kir (Created)" } })
    );
    await stageArticleCard(db as never, "iiwiki", input("Union Assembly"), context);
    expect(createdData(db).metadata).toMatchObject({
      author: "Kir (Created)",
      authorInfo: {
        creator: "Kir",
        displayAuthor: "Kir (Created)",
        createdAt: null,
        primaryContributor: null,
        contributorCount: null,
        isBotFiltered: false,
      },
    });
  });

  it("homes a page a realm imported in that realm", async () => {
    const db = makeDb();
    db.realmPage.findMany.mockResolvedValue([{ realmId: "eurth", kind: "lore" }]);
    await stageArticleCard(db as never, "iiwiki", input("Union Assembly"), context);
    expect(createdData(db).realmId).toBe("eurth");
    expect(db.realmPage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { wikiSource: "iiwiki", title: { equals: "Union Assembly", mode: "insensitive" } },
        select: { realmId: true, kind: true },
      })
    );
  });

  it("skips a realm's nation page", async () => {
    const db = makeDb();
    db.realmPage.findMany.mockResolvedValue([{ realmId: "eurth", kind: "nation" }]);
    const outcome = await stageArticleCard(db as never, "iiwiki", input("Elm"), context);
    expect(outcome).toEqual({
      status: "SKIPPED",
      reason: "A realm's nation page does not become a Lore card",
    });
    expect(generateCard).not.toHaveBeenCalled();
  });

  it("skips a page that already has a card, without asking the wiki", async () => {
    const db = makeDb(["union assembly"]);
    const outcome = await stageArticleCard(db as never, "iiwiki", input("union_assembly"), context);
    expect(outcome).toEqual({ status: "SKIPPED", reason: "Already a card" });
    expect(generateCard).not.toHaveBeenCalled();
    expect(db.realmPage.findMany).not.toHaveBeenCalled();
  });

  it("fails a title MediaWiki would refuse, without asking anything", async () => {
    const db = makeDb();
    expect(await stageArticleCard(db as never, "iiwiki", input("a|b"), context)).toEqual({
      status: "FAILED",
      reason: "Not a valid page title",
    });
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });

  it("blocks art whose licence forbids commercial use or changes, and creates nothing", async () => {
    const db = makeDb();
    capture.mockResolvedValue({ ...openLicence, licence: "CC BY-NC-SA 4.0", status: "RESTRICTED" });
    const outcome = await stageArticleCard(db as never, "iiwiki", input("Union Assembly"), context);
    expect(outcome).toEqual({
      status: "BLOCKED",
      reason: "Its art is licensed CC BY-NC-SA 4.0, which does not allow commercial use or changes",
    });
    expect(db.card.create).not.toHaveBeenCalled();
  });

  it("names a restriction it found without a licence name as restrictive", async () => {
    const db = makeDb();
    capture.mockResolvedValue({ ...openLicence, licence: null, status: "RESTRICTED" });
    expect(await stageArticleCard(db as never, "iiwiki", input("Union Assembly"), context)).toEqual(
      {
        status: "BLOCKED",
        reason: "Its art is licensed restrictively, which does not allow commercial use or changes",
      }
    );
  });

  it("records art with no file page as an unknown licence, still staged", async () => {
    const db = makeDb();
    capture.mockResolvedValue(null);
    const outcome = await stageArticleCard(db as never, "iiwiki", input("Union Assembly"), context);
    expect(outcome).toMatchObject({ status: "STAGED", licence: null });
    const data = createdData(db);
    expect(data.artworkCredit).toBeNull();
    expect(data.artLicence.create).toEqual({
      wiki: "iiwiki",
      importedBy: null,
      importJobId: null,
      fileUrl: candidate().artwork,
      status: "UNKNOWN",
      note: "No file page found for the art",
    });
  });

  it("stages a card without art with procedural art and no licence record", async () => {
    const db = makeDb();
    generateCard.mockResolvedValue(candidate({ artwork: null, imageFile: null, fullExcerpt: "" }));
    await stageArticleCard(db as never, "iiwiki", input("Union Assembly"), context);
    expect(capture).not.toHaveBeenCalled();
    const data = createdData(db);
    expect(data).toMatchObject({ artwork: null, artworkSource: "PROCEDURAL", wikiExcerpt: null });
    expect(data).not.toHaveProperty("artLicence");
  });

  it("asks no licence for art the wiki does not name a file for", async () => {
    const db = makeDb();
    generateCard.mockResolvedValue(candidate({ imageFile: null }));
    await stageArticleCard(db as never, "iiwiki", input("Union Assembly"), context);
    expect(capture).not.toHaveBeenCalled();
    expect(createdData(db).artLicence.create).toMatchObject({ status: "UNKNOWN" });
  });

  it("skips an article the generator rejects, with its reason", async () => {
    const db = makeDb();
    generateCard.mockRejectedValue(
      new ArticleRejected("too-short", '"Stub" is too short (120 characters; the minimum is 600).')
    );
    expect(await stageArticleCard(db as never, "iiwiki", input("Stub"), context)).toEqual({
      status: "SKIPPED",
      reason: '"Stub" is too short (120 characters; the minimum is 600).',
    });
  });

  it("fails an article the generator could not read, with its error", async () => {
    const db = makeDb();
    generateCard.mockRejectedValue(new Error("socket hang up"));
    expect(await stageArticleCard(db as never, "iiwiki", input("Union Assembly"), context)).toEqual(
      { status: "FAILED", reason: "socket hang up" }
    );
    generateCard.mockRejectedValue("bare");
    expect(await stageArticleCard(db as never, "iiwiki", input("Union Assembly"), context)).toEqual(
      { status: "FAILED", reason: "bare" }
    );
  });

  it("lets a wiki that stops answering the licence read stop the run", async () => {
    const db = makeDb();
    const stopped = new DiscoveryStopped({ kind: "blocked", status: 403, message: "refused" });
    capture.mockRejectedValue(stopped);
    await expect(
      stageArticleCard(db as never, "iiwiki", input("Union Assembly"), context)
    ).rejects.toBe(stopped);
    expect(db.card.create).not.toHaveBeenCalled();
  });

  it("lets a wiki that stops answering the article read stop the run", async () => {
    const db = makeDb();
    const stopped = new DiscoveryStopped({ kind: "blocked", status: 403, message: "refused" });
    generateCard.mockRejectedValue(stopped);
    await expect(
      stageArticleCard(db as never, "iiwiki", input("Union Assembly"), context)
    ).rejects.toBe(stopped);
    expect(capture).not.toHaveBeenCalled();
  });

  it("reads a lost natural-key race as already a card", async () => {
    const db = makeDb();
    db.card.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique", { code: "P2002", clientVersion: "6" })
    );
    expect(await stageArticleCard(db as never, "iiwiki", input("Union Assembly"), context)).toEqual(
      { status: "SKIPPED", reason: "Already a card" }
    );
  });

  it("passes any other create failure on", async () => {
    const db = makeDb();
    db.card.create.mockRejectedValue(new Error("database went away"));
    await expect(
      stageArticleCard(db as never, "iiwiki", input("Union Assembly"), context)
    ).rejects.toThrow("database went away");
  });

  it("asks the generator for an image when the caller requires one", async () => {
    const db = makeDb();
    await stageArticleCard(
      db as never,
      "iiwiki",
      { ...input("Union Assembly"), requireImage: true },
      context
    );
    expect(generateCard).toHaveBeenCalledWith("Union Assembly", "iiwiki", {
      requireImage: true,
      minLength: undefined,
    });
  });

  it("lets an accepted suggestion skip the length gate and land approved by its admin", async () => {
    const db = makeDb();
    await stageArticleCard(
      db as never,
      "iiwiki",
      {
        title: "Union Assembly",
        requestedBy: "admin_db",
        jobId: null,
        bypassLengthGate: true,
        reviewState: "APPROVED",
      },
      context
    );
    expect(generateCard).toHaveBeenCalledWith("Union Assembly", "iiwiki", {
      requireImage: undefined,
      minLength: 0,
    });
    expect(createdData(db)).toMatchObject({
      reviewState: "APPROVED",
      reviewedBy: "admin_db",
      reviewedAt: expect.any(Date),
    });
  });
});

describe("stageCommonsFile", () => {
  const commons: ImportContext = { ...context, thresholds: DEFAULT_RARITY_THRESHOLDS.commons };
  const flag = {
    ...openLicence,
    fileTitle: "File:Flag of Ireland.svg",
    fileUrl: "https://upload.wikimedia.org/wikipedia/commons/4/45/Flag_of_Ireland.svg",
    descriptionUrl: "https://commons.wikimedia.org/wiki/File:Flag_of_Ireland.svg",
    licence: "Public domain",
  };

  it("stages a Commons file as a Lore card in Ixnay, titled from the file", async () => {
    const db = makeDb();
    db.card.create.mockResolvedValue({ id: "card_flag", rarity: "COMMON" });
    capture.mockResolvedValue(flag);
    const outcome = await stageCommonsFile(
      db as never,
      { title: "File:Flag_of_Ireland.svg", requestedBy: "admin_db", jobId: "job_2" },
      commons
    );
    expect(outcome).toEqual({
      status: "STAGED",
      cardId: "card_flag",
      rarity: "COMMON",
      licence: "Public domain",
    });
    expect(capture).toHaveBeenCalledWith(commons.query, "commons", "File:Flag of Ireland.svg");
    expect(createdData(db)).toMatchObject({
      title: "Flag of Ireland",
      artwork: flag.fileUrl,
      artworkSource: "WIKI_FETCHED",
      artworkCredit: flag.attribution,
      cardType: "LORE",
      wikiSource: "commons",
      wikiArticleTitle: "File:Flag of Ireland.svg",
      realmId: "default",
      rarity: "COMMON",
      marketValue: 10,
      reviewState: "PENDING",
      metadata: { descriptionUrl: flag.descriptionUrl },
      artLicence: {
        create: expect.objectContaining({
          wiki: "commons",
          fileUrl: flag.fileUrl,
          licence: "Public domain",
          importedBy: "admin_db",
          importJobId: "job_2",
        }),
      },
    });
    expect(createdData(db).category).toEqual(expect.any(String));
    expect(db.realmPage.findMany).not.toHaveBeenCalled();
    expect(db.cardOwnership.create).not.toHaveBeenCalled(); // no free copy for the importing admin
  });

  it("takes a file name with or without its namespace", async () => {
    const db = makeDb();
    capture.mockResolvedValue(flag);
    await stageCommonsFile(db as never, input("Flag_of_Ireland.svg"), commons);
    expect(capture).toHaveBeenCalledWith(commons.query, "commons", "File:Flag of Ireland.svg");
  });

  it("skips a file that already has a card, without asking Commons", async () => {
    const db = makeDb(["file:flag of ireland.svg"]);
    expect(await stageCommonsFile(db as never, input("File:Flag of Ireland.svg"), commons)).toEqual(
      { status: "SKIPPED", reason: "Already a card" }
    );
    expect(capture).not.toHaveBeenCalled();
    expect(db.$queryRaw.mock.calls[0]![1]).toBe("commons");
  });

  it("fails a file name MediaWiki would refuse", async () => {
    const db = makeDb();
    expect(await stageCommonsFile(db as never, input("a|b.svg"), commons)).toEqual({
      status: "FAILED",
      reason: "Not a valid file name",
    });
    expect(capture).not.toHaveBeenCalled();
  });

  it("fails a file Commons does not have", async () => {
    const db = makeDb();
    capture.mockResolvedValue(null);
    expect(await stageCommonsFile(db as never, input("File:Nope.svg"), commons)).toEqual({
      status: "FAILED",
      reason: "Wikimedia Commons has no such file",
    });
  });

  it("blocks a file licensed non-commercial", async () => {
    const db = makeDb();
    capture.mockResolvedValue({ ...flag, licence: "CC BY-NC 2.0", status: "RESTRICTED" });
    expect(await stageCommonsFile(db as never, input("File:Flag.svg"), commons)).toMatchObject({
      status: "BLOCKED",
    });
    expect(db.card.create).not.toHaveBeenCalled();
  });
});

describe("stageForAdmin", () => {
  beforeEach(() => jest.mocked(wikiQueryFor).mockReturnValue(context.query));

  it("stages one page with a one-off context, answering the card", async () => {
    const db = makeDb();
    await expect(
      stageForAdmin(db as never, "iiwiki", { ...input("Union Assembly"), requireImage: true })
    ).resolves.toEqual({ cardId: "card_new", rarity: "RARE" });
    expect(wikiQueryFor).toHaveBeenCalledWith("iiwiki", undefined);
    expect(generateCard).toHaveBeenCalledWith("Union Assembly", "iiwiki", {
      requireImage: true,
      minLength: undefined,
    });
  });

  it("refuses a page that did not become a card, with the reason", async () => {
    const db = makeDb(["union assembly"]);
    const refused = stageForAdmin(db as never, "iiwiki", input("Union Assembly"));
    await expect(refused).rejects.toBeInstanceOf(TRPCError);
    await expect(refused).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Already a card" });
  });

  it.each([
    [{ kind: "blocked", status: 403 }, "IIWiki stopped answering (HTTP 403)."],
    [{ kind: "rate-limited", status: 429 }, "IIWiki stopped answering (HTTP 429)."],
    [{ kind: "blocked", status: 200 }, "IIWiki answered with a web page instead of data."],
    [{ kind: "blocked", status: null }, "IIWiki does not allow reading its pages."],
    [{ kind: "unreachable", status: null }, "IIWiki stopped answering."],
  ] as const)("says which wiki stopped answering (%o), naming it once", async (stop, message) => {
    const db = makeDb();
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    generateCard.mockRejectedValue(
      new DiscoveryStopped({ ...stop, message: "iiwiki refused the request (HTTP 403)" })
    );
    await expect(
      stageForAdmin(db as never, "iiwiki", input("Union Assembly"))
    ).rejects.toMatchObject({ code: "BAD_GATEWAY", message });
    // The wiki's own words are for the server log.
    expect(error).toHaveBeenCalledWith(
      '[Card import] IIWiki stopped answering for "Union Assembly": iiwiki refused the request (HTTP 403)'
    );
  });

  it("reports a failed read as the wiki's, without its raw error, and logs the error", async () => {
    const db = makeDb();
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    generateCard.mockRejectedValue(
      new Error("Invalid `prisma.wikiArticle.findFirst()` invocation")
    );
    const failed = stageForAdmin(db as never, "iiwiki", input("Union Assembly"));
    await expect(failed).rejects.toBeInstanceOf(TRPCError);
    await expect(failed).rejects.toMatchObject({
      code: "BAD_GATEWAY",
      message: 'Could not read "Union Assembly" from IIWiki. Try again later.',
    });
    expect(error).toHaveBeenCalledWith(
      '[Card import] Could not read "Union Assembly" from IIWiki: Invalid `prisma.wikiArticle.findFirst()` invocation'
    );
  });

  it("refuses a title MediaWiki would refuse as a bad request, not a failed read", async () => {
    const db = makeDb();
    await expect(stageForAdmin(db as never, "iiwiki", input("a|b"))).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Not a valid page title",
    });
  });

  it("refuses blocked art as a bad request, with its reason", async () => {
    const db = makeDb();
    capture.mockResolvedValue({ ...openLicence, licence: "CC BY-NC-SA 4.0", status: "RESTRICTED" });
    await expect(
      stageForAdmin(db as never, "iiwiki", input("Union Assembly"))
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message:
        "Its art is licensed CC BY-NC-SA 4.0, which does not allow commercial use or changes",
    });
  });

  it("passes any other failure on", async () => {
    const db = makeDb();
    db.card.create.mockRejectedValue(new Error("database went away"));
    await expect(stageForAdmin(db as never, "iiwiki", input("Union Assembly"))).rejects.toThrow(
      "database went away"
    );
  });
});

describe("the importer's lookups", () => {
  it("answers no carded titles for no titles, without a query", async () => {
    const db = makeDb();
    await expect(cardedTitleKeys(db as never, "ixwiki", [])).resolves.toEqual(new Set());
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });

  it("asks once per page however many spellings it is given", async () => {
    const db = makeDb(["caphiria"]);
    const keys = await cardedTitleKeys(db as never, "ixwiki", ["Caphiria", "caphiria", "Elm_land"]);
    expect(keys).toEqual(new Set(["caphiria"]));
    expect((db.$queryRaw.mock.calls[0]![2] as { values: string[] }).values).toEqual([
      "caphiria",
      "elm land",
    ]);
  });

  it("homes a Commons file in Ixnay without asking for realm pages", async () => {
    const db = makeDb();
    await expect(resolveImportRealm(db as never, "commons", "File:Flag.svg")).resolves.toEqual({
      realmId: "default",
      nationPage: false,
    });
    expect(db.realmPage.findMany).not.toHaveBeenCalled();
  });

  it("builds a one-off context from the source's stored rarity table", async () => {
    const db = makeDb();
    const tuned = { UNCOMMON: 10, RARE: 20, ULTRA_RARE: 30, EPIC: 40, LEGENDARY: 50 };
    db.systemConfig.findMany.mockResolvedValue([
      { key: "card_rarity_thresholds_althistory", value: JSON.stringify(tuned) },
    ]);
    const query = jest.fn();
    jest.mocked(wikiQueryFor).mockReturnValue(query);
    await expect(oneOffImportContext(db as never, "althistory")).resolves.toEqual({
      query,
      thresholds: tuned,
    });
    expect(wikiQueryFor).toHaveBeenCalledWith("althistory", undefined);
  });

  it("gives a longer run a bigger licence budget", async () => {
    const db = makeDb();
    await oneOffImportContext(db as never, "iiwiki", 300);
    expect(wikiQueryFor).toHaveBeenCalledWith("iiwiki", 300);
  });
});
