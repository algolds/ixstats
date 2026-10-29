/** @jest-environment node */
import fs from "fs";
import path from "path";

const ui = (name: string) =>
  fs.readFileSync(path.resolve(__dirname, "../../components/ui", name), "utf8");

describe("Facet touch targets on coarse pointers", () => {
  it("menu rows are 44px tall", () => {
    const menuRow = /const menuRow =\s*"([^"]+)"/.exec(ui("dropdown-menu.tsx"))?.[1] ?? "";
    expect(menuRow).toContain("pointer-coarse:min-h-11");
  });

  it("the sheet grabber is 44px tall", () => {
    const grabber =
      /data-slot="sheet-grabber"[\s\S]*?className="([^"]+)"/.exec(ui("sheet.tsx"))?.[1] ?? "";
    expect(grabber).toContain("pointer-coarse:h-11");
  });
});
