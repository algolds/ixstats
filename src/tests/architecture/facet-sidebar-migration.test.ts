import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "../../..");
const read = (p: string) =>
  fs.existsSync(path.join(ROOT, p)) ? fs.readFileSync(path.join(ROOT, p), "utf8") : "";

describe("per-app sidebars are migrated to the source list", () => {
  it("dashboard: no widget column; the right column is an Inspector", () => {
    const layout = read("src/components/dashboard/sidebar/DashboardSidebarLayout.tsx");
    expect(layout).not.toMatch(/VaultWidget|DashboardPlayerWidget|QuickLinks/);
    expect(read("src/components/dashboard/sections/UnifiedDashboardSection.tsx")).toMatch(
      /<Inspector\b/
    );
  });
});
