/** @jest-environment node */
import fs from "fs";
import path from "path";

// Default icon sizes in UI primitives must lose to an icon's own size classes.
// `[&_svg]:size-4` compiles to `.btn svg` (beats `.h-5`); `[:where(&)_svg]:size-4`
// compiles to `:where(.btn) svg` (loses to `.h-5`, still sizes unsized icons).
describe("icon sizing", () => {
  const rootDir = path.resolve(__dirname, "../../..");
  const uiDir = path.join(rootDir, "src/components/ui");
  const uiFiles = fs.readdirSync(uiDir).filter((f) => f.endsWith(".tsx"));

  test.each(uiFiles)("%s does not force icon sizes with high-specificity selectors", (file) => {
    const content = fs.readFileSync(path.join(uiDir, file), "utf-8");
    expect(
      content.match(/\[&(?:_|>)svg(?:[^\]\s[]|\[[^\]]*\])*\]:(?:size|h|w)-[\d.]+/g) ?? []
    ).toEqual([]);
  });

  test("IxWikiLogo sizes via attributes so className sizes can override", () => {
    const content = fs.readFileSync(
      path.join(rootDir, "src/components/wiki-os/shared/IxWikiLogo.tsx"),
      "utf-8"
    );
    expect(content).not.toMatch(/style=\{\{\s*width:\s*size/);
  });
});
