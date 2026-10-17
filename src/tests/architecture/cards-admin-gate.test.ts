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
