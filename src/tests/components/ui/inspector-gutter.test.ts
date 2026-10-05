/** @jest-environment node */
/**
 * The Inspector lives in the gutter the shell reserves (shell.css), so no page lays out a
 * side-by-side flex column for it any more.
 */
import fs from "fs";
import path from "path";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../../../..", p), "utf8");

describe("Inspector users do not lay out a column for it", () => {
  it("UnifiedDashboardSection", () => {
    expect(read("src/components/dashboard/sections/UnifiedDashboardSection.tsx")).not.toMatch(
      /flex gap-5 lg:gap-6/
    );
  });

  it("SportsShell", () => {
    expect(read("src/components/sports/core/SportsShell.tsx")).not.toMatch(
      /flex items-start gap-6/
    );
  });

  it("ThinktankLayout", () => {
    expect(read("src/components/thinktanks/ThinktankLayout.tsx")).not.toMatch(
      /flex gap-5 lg:gap-6/
    );
  });

  it("the Inspector itself carries no inline width or sticky layout", () => {
    const source = read("src/components/ui/inspector.tsx");
    expect(source).not.toMatch(/\bsticky\b|\bw-80\b/);
  });
});
