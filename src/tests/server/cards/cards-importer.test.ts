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
  fileCategories: jest.fn(),
  wikiQueryFor: jest.fn(),
}));

import { Prisma } from "@prisma/client";
import { wikiLoreCardGenerator } from "~/lib/cards/lore-card-generator";
import {
  ABANDONED_LORE_REASON,
  ArticleRejected,
  type LoreCardCandidate,
} from "~/lib/cards/lore-card-candidate";
import {
  captureArtLicence,
  fileCategories,
  wikiQueryFor,
} from "~/server/modules/cards/cards.art-licence";
import type { WikiQuery } from "~/lib/realms/lore-import";
import { DEFAULT_RARITY_THRESHOLDS } from "~/lib/cards/rarity-engine";
import { TRPCError } from "@trpc/server";
import {
  stageArticleCard,
  stageCommonsFile,
  stageForAdmin,
  type ImportContext,
} from "~/server/modules/cards/cards.importer";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const generateCard = jest.mocked(wikiLoreCardGenerator.generateCard);
const capture = jest.mocked(captureArtLicence);
const fileCats = jest.mocked(fileCategories);
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
  classification: { category: "GOVERNMENT", subcategory: "legislature-or-body", confidence: 0.9 },
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
  fileCats.mockResolvedValue([]);
});

describe("stageArticleCard", () => {
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
  it("refuses to stage an article tagged Abandoned Lore, saying so", async () => {
    const db = makeDb();
    generateCard.mockRejectedValue(new ArticleRejected("abandoned", ABANDONED_LORE_REASON));
    const outcome = await stageArticleCard(db as never, "ixwiki", input("Old Draft"), context);
    expect(outcome).toEqual({ status: "SKIPPED", reason: "Its article is tagged Abandoned Lore" });
    expect(capture).not.toHaveBeenCalled();
    expect(db.card.create).not.toHaveBeenCalled();
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
  it("writes the classifier's category, subcategory, confidence and review flag, and no legacy label", async () => {
    const db = makeDb();
    generateCard.mockResolvedValue(
      candidate({
        classification: {
          category: "GOVERNMENT",
          subcategory: "legislature-or-body",
          confidence: 0.32,
        },
      })
    );
    await stageArticleCard(db as never, "iiwiki", input("Union Assembly"), context);
    expect(createdData(db)).toMatchObject({
      category: "GOVERNMENT",
      subcategory: "legislature-or-body",
      categorySource: "CLASSIFIER",
      categoryConfidence: 0.32,
      categoryNeedsReview: true,
    });
    expect(createdData(db).metadata).not.toHaveProperty("category");
  });
  it("stages a confident classification without sending it to review", async () => {
    const db = makeDb();
    await stageArticleCard(db as never, "iiwiki", input("Union Assembly"), context);
    expect(createdData(db)).toMatchObject({
      category: "GOVERNMENT",
      categoryConfidence: 0.9,
      categoryNeedsReview: false,
    });
  });
  it("stages an article nothing classifies as Uncategorised, waiting for review", async () => {
    const db = makeDb();
    generateCard.mockResolvedValue(
      candidate({ classification: { category: null, subcategory: null, confidence: 0 } })
    );
    await stageArticleCard(db as never, "iiwiki", input("Union Assembly"), context);
    expect(createdData(db)).toMatchObject({
      category: null,
      subcategory: null,
      categorySource: "CLASSIFIER",
      categoryNeedsReview: true,
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
  it("blocks a file licensed non-commercial", async () => {
    const db = makeDb();
    capture.mockResolvedValue({ ...flag, licence: "CC BY-NC 2.0", status: "RESTRICTED" });
    expect(await stageCommonsFile(db as never, input("File:Flag.svg"), commons)).toMatchObject({
      status: "BLOCKED",
    });
    expect(db.card.create).not.toHaveBeenCalled();
  });
  it("classifies a Commons file by its file page's categories, not its title alone", async () => {
    const db = makeDb();
    capture.mockResolvedValue(flag);
    fileCats.mockResolvedValue(["Flags of Ireland", "SVG flags"]);
    await stageCommonsFile(db as never, input("File:Flag of Ireland.svg"), commons);
    expect(fileCats).toHaveBeenCalledWith(commons.query, "File:Flag of Ireland.svg");
    expect(createdData(db)).toMatchObject({
      category: "NATION",
      subcategory: "nation",
      categorySource: "CLASSIFIER",
    });
    expect(createdData(db).metadata).toEqual({ descriptionUrl: flag.descriptionUrl });
  });
  it("stages a Commons file its categories do not classify as Uncategorised, waiting for review", async () => {
    const db = makeDb();
    capture.mockResolvedValue({ ...flag, fileTitle: "File:Sunset.jpg" });
    await stageCommonsFile(db as never, input("File:Sunset.jpg"), commons);
    expect(createdData(db)).toMatchObject({ category: null, categoryNeedsReview: true });
  });
  it("reads no file categories for a file it blocks", async () => {
    const db = makeDb();
    capture.mockResolvedValue({ ...flag, licence: "CC BY-NC 2.0", status: "RESTRICTED" });
    await stageCommonsFile(db as never, input("File:Flag.svg"), commons);
    expect(fileCats).not.toHaveBeenCalled();
  });
});
describe("fileCategories", () => {
  const { fileCategories: actualFileCategories } = jest.requireActual<
    typeof import("~/server/modules/cards/cards.art-licence")
  >("~/server/modules/cards/cards.art-licence");
  it("asks for the file page's visible categories and strips their prefix", async () => {
    const query = jest.fn().mockResolvedValue({
      query: {
        pages: [
          {
            title: "File:Flag of Ireland.svg",
            categories: [{ title: "Category:Flags of Ireland" }, { title: "Category:SVG flags" }],
          },
        ],
      },
    });
    expect(await actualFileCategories(query as WikiQuery, "File:Flag of Ireland.svg")).toEqual([
      "Flags of Ireland",
      "SVG flags",
    ]);
    expect(query.mock.calls[0]![0]).toEqual({
      titles: "File:Flag of Ireland.svg",
      prop: "categories",
      clshow: "!hidden",
      cllimit: "50",
    });
  });
  it("reads a missing page as no categories", async () => {
    const query = jest.fn().mockResolvedValue({});
    expect(await actualFileCategories(query as WikiQuery, "File:Gone.svg")).toEqual([]);
  });
});

describe("stageForAdmin", () => {
  beforeEach(() => jest.mocked(wikiQueryFor).mockReturnValue(context.query));
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
});
