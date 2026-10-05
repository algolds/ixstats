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

  it("vault, achievements and thinktanks: no VaultSidebarLayout or default rail", () => {
    const exists = (p: string) => fs.existsSync(path.join(ROOT, p));
    for (const gone of [
      "src/components/vault/VaultSidebarLayout.tsx",
      "src/components/mycountry/shell/VaultWidget.tsx",
      "src/components/dashboard/sidebar/DashboardPlayerWidget.tsx",
      "src/components/dashboard/sidebar/DashboardQuickLinks.tsx",
      "src/components/dashboard/sidebar/ServerDiscordBadge.tsx",
    ]) {
      expect(exists(gone)).toBe(false);
    }
    for (const p of [
      "src/app/vault/layout.tsx",
      "src/app/achievements/page.tsx",
      "src/app/leaderboards/page.tsx",
      "src/app/thinktanks/layout.tsx",
    ]) {
      expect(read(p)).not.toMatch(/VaultSidebarLayout|DashboardSidebarLayout/);
    }
    expect(read("src/components/vault/sections/VaultDashboardSection.tsx")).toMatch(
      /DailyRewardStatus/
    );
    expect(read("src/components/thinktanks/ThinktankLayout.tsx")).toMatch(/<Inspector\b/);
  });

  it("the daily reward does not auto-open on chromeless routes", () => {
    expect(read("src/components/shell/AppShell.tsx")).toMatch(/autoOpen=\{!chromeless\}/);
  });

  it("wiki: no unified sidebar; article tabs and a New page action", () => {
    const exists = (p: string) => fs.existsSync(path.join(ROOT, p));
    for (const gone of [
      "src/components/wiki-os/shared/WikiOSUnifiedSidebar.tsx",
      "src/components/wiki-os/shared/WikiOSProfileWidget.tsx",
      "src/components/wiki-os/shared/ActiveCountryUnifiedWidget.tsx",
      "src/components/wiki-os/shared/FisheyeRailItem.tsx",
    ]) {
      expect(exists(gone)).toBe(false);
    }
    expect(read("src/components/wiki-os/shared/WikiOSLayout.tsx")).not.toMatch(
      /DashboardSidebarLayout|WikiOSUnifiedSidebar/
    );
    const wiki = [
      "src/components/wiki-os/reader/ArticleRenderer.tsx",
      "src/components/wiki-os/shared/WikiOSLayout.tsx",
      "src/components/wiki-os/reader/WikiArticleTabs.tsx",
      "src/components/wiki-os/shared/WikiPageActions.tsx",
    ]
      .map(read)
      .join("\n");
    expect(wiki).toMatch(/TabsTrigger[^>]*>\s*Read|"Read"/);
    expect(wiki).toMatch(/New page/);
  });

  it("no layout renders a collapsible rail any more", () => {
    const layout = read("src/components/dashboard/sidebar/DashboardSidebarLayout.tsx");
    expect(layout).not.toMatch(/sidebarContent|useSidebar|RailBalancer/);
  });
});
