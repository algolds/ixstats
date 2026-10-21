/**
 * Cards refresh §5.4: the retired crafting router went with its tables. Phase 4 brings the `crafting` name back for the
 * card workshop (dust, breaking down, fusing), with no recipe or history tables.
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "../../..");
const GONE = ["src/lib/cards/crafting-rules.ts", "prisma/seeds/crafting-recipes.ts"];

describe("the retired crafting is gone", () => {
  it.each(GONE)("%s is deleted", (file) => {
    expect(fs.existsSync(path.join(ROOT, file))).toBe(false);
  });

  it("registers the workshop under the crafting name", () => {
    const root = fs.readFileSync(path.join(ROOT, "src/server/api/root.ts"), "utf8");
    expect(root).toMatch(/crafting: craftingRouter/);
  });

  it("has no recipe or history tables", () => {
    const schemaDir = path.join(ROOT, "prisma/schema");
    const schema = fs
      .readdirSync(schemaDir)
      .filter((file) => file.endsWith(".prisma"))
      .map((file) => fs.readFileSync(path.join(schemaDir, file), "utf8"))
      .join("\n");
    expect(schema).not.toMatch(/CraftingRecipe|CraftingHistory/);
  });
});
