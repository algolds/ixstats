/** Every card admin procedure is admin-only and lives under cards.admin (cards refresh spec §2.4, §3). */
jest.mock("~/server/db", () => ({ db: {} }));

import fs from "fs";
import path from "path";
import { cardsRouter } from "~/server/api/routers/cards";

const DIR = path.resolve(__dirname, "../../server/api/routers/cards/admin");
const OTHER_BUILDERS =
  /\b(publicProcedure|protectedProcedure|premiumProcedure|rateLimitedMutationProcedure|rateLimitedPublicProcedure|lightMutationProcedure|readOnlyProcedure|wikiReadProcedure|countryOwnerProcedure)\b/;

describe("cards admin router", () => {
  it("builds every procedure on adminProcedure", () => {
    const files = fs.readdirSync(DIR).filter((file) => file.endsWith(".ts"));
    expect(files.length).toBeGreaterThanOrEqual(13);
    const offenders = files.filter((file) =>
      OTHER_BUILDERS.test(fs.readFileSync(path.join(DIR, file), "utf8"))
    );
    expect(offenders).toEqual([]);
  });

  it("is mounted at cards.admin", () => {
    expect(Object.keys(cardsRouter._def.procedures)).toContain("admin.overview.summary");
  });
});

const CARDS_ADMIN_PROCEDURES = {
  overview: ["summary", "activity", "realms", "findCards"],
  library: ["list", "update", "bulkSetRetired"],
  imports: [
    "searchCategories",
    "categoryCounts",
    "crawl",
    "start",
    "jobs",
    "items",
    "cancel",
    "retry",
    "resume",
  ],
  nationstates: [
    "logs",
    "logCards",
    "active",
    "start",
    "pause",
    "resume",
    "stop",
    "discoverRegions",
    "filterCte",
  ],
  curation: ["queue", "review", "suggestions", "acceptSuggestion", "declineSuggestion"],
  packs: ["list", "save", "setActive", "preview"],
  economy: [
    "get",
    "saveValues",
    "recomputeValues",
    "saveMarket",
    "saveBonuses",
    "saveLorewardPayouts",
    "saveRarityThresholds",
    "saveDailyImport",
  ],
  seasons: ["get", "set"],
  compliance: ["takedowns", "file", "hide", "decline", "restore", "licences", "setLicence"],
  designer: ["list", "save", "achievements"],
  tools: ["playerCards", "grant", "revoke", "cancelAuction", "voidTrade", "awardPack"],
} as const;

const CARD_ROUTER_DIRS = ["cards", "lore-cards", "card-packs", "ns-import"].map((dir) =>
  path.resolve(__dirname, "../../server/api/routers", dir)
);

describe("cards admin surface", () => {
  it("serves exactly the nine tabs', NationStates and player tool procedures under cards.admin", () => {
    const expected = Object.entries(CARDS_ADMIN_PROCEDURES).flatMap(([tab, names]) =>
      names.map((name) => `admin.${tab}.${name}`)
    );
    const actual = Object.keys(cardsRouter._def.procedures).filter((key) =>
      key.startsWith("admin.")
    );
    expect(actual.sort()).toEqual(expected.sort());
  });

  it("leaves no admin procedure in a card router outside cards/admin", () => {
    const files = CARD_ROUTER_DIRS.flatMap((dir) =>
      fs
        .readdirSync(dir)
        .filter((file) => file.endsWith(".ts"))
        .map((file) => path.join(dir, file))
    );
    expect(
      files.filter((file) => /\badminProcedure\b/.test(fs.readFileSync(file, "utf8")))
    ).toEqual([]);
  });
});
