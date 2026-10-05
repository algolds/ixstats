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

  it("forum: no hidden rails; Reply and Share are thread header actions", () => {
    const layout = read("src/components/forum/shared/ForumLayout.tsx");
    expect(layout).not.toMatch(/data-app-subnav|forum-icon-rail|forum-mobile-nav/);
    expect(read("src/styles/forum.css")).not.toMatch(/forum-icon-rail|forum-mobile-nav/);
    const header = read("src/components/forum/reader/ThreadHeader.tsx");
    expect(header).toMatch(/onClick=\{onReply\}/);
    expect(header).toMatch(/onClick=\{handleShare\}/);
  });

  it("sports: no left nav, command bar or main-column Card; tabs and Inspector instead", () => {
    const exists = (p: string) => fs.existsSync(path.join(ROOT, p));
    expect(exists("src/components/sports/core/SportsSidebarNav.tsx")).toBe(false);
    expect(exists("src/components/sports/core/SportsCommandBar.tsx")).toBe(false);
    const shell = read("src/components/sports/core/SportsShell.tsx");
    expect(shell).not.toMatch(/<aside|SportsSidebarNav|SportsCommandBar/);
    expect(shell).not.toMatch(/<Card\b/);
    expect(shell + read("src/components/sports/core/SportsFocusPanel.tsx")).toMatch(/<Inspector\b/);
    expect(read("src/components/sports/core/SportsSectionTabs.tsx")).toMatch(/TabsList|<Tabs\b/);
    expect(read("src/components/sports/league/LeagueRouter.tsx")).toMatch(/<SportsSectionTabs\b/);
    expect(read("src/components/sports/club/ClubRouter.tsx")).toMatch(/<SportsSectionTabs\b/);
  });

  it("admin: the source list's area mode replaces the admin sidebar widget", () => {
    const exists = (p: string) => fs.existsSync(path.join(ROOT, p));
    expect(exists("src/app/admin/_components/AdminSidebarNavWidget.tsx")).toBe(false);
    expect(exists("src/app/admin/_components/AdminSidebarLayout.tsx")).toBe(false);
    expect(read("src/app/admin/layout.tsx")).not.toMatch(
      /AdminSidebarNavWidget|AdminSidebarLayout|<aside|data-app-subnav/
    );
    expect(read("src/app/admin/layout.tsx")).toMatch(/data-app="admin"/);
  });

  it("no layout renders a collapsible rail any more", () => {
    const layout = read("src/components/dashboard/sidebar/DashboardSidebarLayout.tsx");
    expect(layout).not.toMatch(/sidebarContent|useSidebar|RailBalancer/);
  });

  it("mycountry: no hidden domain tiles or segmented control in the command bar", () => {
    const bar = read("src/components/mycountry/shell/headers/UnifiedGlassCommandBar.tsx");
    expect(bar).not.toMatch(/data-app-subnav/);
    expect(bar).not.toMatch(/SegmentedControl/);
    expect(bar).not.toMatch(/DomainTileButton|DOMAIN_TILES|InboxCountPill/);
    expect(read("src/components/mycountry/shell/ExecutiveHome.tsx")).toMatch(/<DomainPeeksCard\b/);
    expect(read("src/components/mycountry/shell/DomainPeeksCard.tsx")).toMatch(
      /content="navigation"/
    );
  });

  it("no data-app-subnav anywhere", () => {
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        return e.isDirectory() ? walk(p) : /\.(tsx?|css)$/.test(e.name) ? [p] : [];
      });
    const offenders = walk(path.join(ROOT, "src"))
      .filter((f) => !f.includes(`${path.sep}tests${path.sep}`))
      .filter((f) => fs.readFileSync(f, "utf8").includes("data-app-subnav"));
    expect(offenders.map((f) => path.relative(ROOT, f))).toEqual([]);
  });

  it("settings: the page renders its panels only; the sidebar's area list is the navigation", () => {
    const exists = (p: string) => fs.existsSync(path.join(ROOT, p));
    expect(exists("src/app/settings/_components/SettingsSidebarNav.tsx")).toBe(false);
    expect(read("src/app/settings/_components/SettingsContent.tsx")).not.toMatch(
      /SettingsSidebarNav|<aside/
    );
  });
});
