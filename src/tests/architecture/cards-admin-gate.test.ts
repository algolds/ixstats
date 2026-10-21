/** Every card admin procedure is admin-only and lives under cards.admin (cards refresh spec §2.4, §3). */
jest.mock("~/server/db", () => ({ db: {} }));

import fs from "fs";
import path from "path";
const DIR = path.resolve(__dirname, "../../server/api/routers/cards/admin");
const OTHER_BUILDERS =
  /\b(publicProcedure|protectedProcedure|premiumProcedure|rateLimitedMutationProcedure|rateLimitedPublicProcedure|lightMutationProcedure|readOnlyProcedure|wikiReadProcedure|countryOwnerProcedure)\b/;

describe("cards admin router", () => {
  it("builds every procedure on adminProcedure", () => {
    const files = fs.readdirSync(DIR).filter((file) => file.endsWith(".ts"));
    expect(files.length).toBeGreaterThanOrEqual(12);
    const offenders = files.filter((file) =>
      OTHER_BUILDERS.test(fs.readFileSync(path.join(DIR, file), "utf8"))
    );
    expect(offenders).toEqual([]);
  });
});
const CARD_ROUTER_DIRS = ["cards", "lore-cards", "card-packs", "ns-import"].map((dir) =>
  path.resolve(__dirname, "../../server/api/routers", dir)
);

describe("cards admin surface", () => {
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
