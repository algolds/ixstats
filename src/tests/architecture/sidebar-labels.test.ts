/** @jest-environment node */
/**
 * App names in the sidebar never truncate: at the narrowest expanded width (224px) a row's label gets
 * the whole row, so nothing sits beside it (no icon buttons, no streak pill) and it does not ellipsize.
 */
import fs from "fs";
import path from "path";

const read = (file: string) => fs.readFileSync(path.resolve(__dirname, "../..", file), "utf8");

describe("sidebar labels", () => {
  it("SourceList renders no streak pill", () => {
    expect(read("components/shell/SourceList.tsx")).not.toContain("StreakPill");
  });

  it("the app label span never truncates", () => {
    const match = /<span className="([^"]*)">\{app\.label\}<\/span>/.exec(
      read("components/shell/SourceList.tsx")
    );
    expect(match).not.toBeNull();
    expect(match?.[1]).toContain("whitespace-nowrap");
    expect(match?.[1]).not.toContain("truncate");
  });

  it("DailyRewardStatus shows neither the streak pill nor a truncating label", () => {
    const source = read("components/vault/DailyRewardProvider.tsx");
    const body = source.slice(source.indexOf("export function DailyRewardStatus"));
    expect(body).not.toContain("StreakPill");
    expect(body).not.toContain("truncate");
  });
});
