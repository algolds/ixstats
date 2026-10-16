/** Cards refresh §5.4: the retired crafting router goes with its tables. */
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "../../..");
const GONE = [
  "src/server/api/routers/crafting",
  "src/lib/cards/crafting-rules.ts",
  "prisma/seeds/crafting-recipes.ts",
];

describe("crafting is gone", () => {
  it.each(GONE)("%s is deleted", (file) => {
    expect(fs.existsSync(path.join(ROOT, file))).toBe(false);
  });

  it("is no longer registered on the API", () => {
    const root = fs.readFileSync(path.join(ROOT, "src/server/api/root.ts"), "utf8");
    expect(root).not.toMatch(/craftingRouter|routers\/crafting/);
  });
});
