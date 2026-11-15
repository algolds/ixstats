import { render, screen, within } from "@testing-library/react";
import { TooltipProvider } from "~/components/ui/tooltip";
import { AppSidebar } from "~/components/shell/AppSidebar";
import { SourceList } from "~/components/shell/SourceList";
import { getApp, getVisibleApps } from "~/lib/navigation/app-sections";

describe("ThinkPages and Vault sidebar navigation", () => {
  const visibleApps = getVisibleApps({ signedIn: true, isAdmin: false, forumModerator: true });
  const thinkpagesApp = visibleApps.find((a) => a.id === "thinkpages")!;
  const vaultApp = getApp("vault");

  it("links ThinkPages directly to /thinkpages with no expand chevron or child rows when outside ThinkPages", () => {
    render(
      <SourceList
        pathname="/dashboard"
        searchParams={null}
        apps={[thinkpagesApp]}
        expanded={new Set(["thinkpages"])}
        onToggle={() => {}}
        badges={{}}
      />
    );

    const link = screen.getByRole("link", { name: "ThinkPages" });
    expect(link).toHaveAttribute("href", "/thinkpages");
    expect(screen.queryByRole("button", { name: /ThinkPages/i })).toBeNull();
    expect(screen.queryByRole("link", { name: "Forums" })).toBeNull();
    expect(screen.queryByRole("link", { name: "ThinkTanks" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Accounts" })).toBeNull();
  });

  it("discloses ThinkPages child rows once on a ThinkPages route", () => {
    render(
      <SourceList
        pathname="/thinkpages"
        searchParams={null}
        apps={[thinkpagesApp]}
        expanded={new Set()}
        onToggle={() => {}}
        badges={{}}
      />
    );

    expect(screen.getByRole("link", { name: "Forums" })).toHaveAttribute("href", "/thinkpages");
    expect(screen.getByRole("link", { name: "ThinkTanks" })).toHaveAttribute("href", "/thinktanks");
    expect(screen.getByRole("link", { name: "Accounts" })).toHaveAttribute(
      "href",
      "/dashboard/accounts"
    );
    expect(screen.getByRole("link", { name: "Moderation" })).toHaveAttribute(
      "href",
      "/thinkpages/mod"
    );
  });

  it("renders collapsed rail ThinkPages as a direct link outside ThinkPages", () => {
    const { container } = render(
      <TooltipProvider>
        <AppSidebar
          pathname="/dashboard"
          searchParams={null}
          apps={[thinkpagesApp]}
          collapsed={true}
          onCollapsedChange={() => {}}
          expanded={new Set()}
          onToggle={() => {}}
          badges={{}}
        />
      </TooltipProvider>
    );

    const railNav = container.querySelector('nav[aria-label="Apps"]') as HTMLElement;
    expect(railNav).not.toBeNull();
    const railLink = within(railNav).getByRole("link", { name: "ThinkPages" });
    expect(railLink).toHaveAttribute("href", "/thinkpages");
    expect(within(railNav).queryByRole("button", { name: "ThinkPages" })).toBeNull();
  });

  it("lists all Vault destinations including Lorewards and grouped Cards routes in the sidebar", () => {
    render(
      <SourceList
        pathname="/vault/achievements"
        searchParams={new URLSearchParams("tab=lorewards")}
        apps={[vaultApp]}
        expanded={new Set(["vault:Cards"])}
        onToggle={() => {}}
        badges={{}}
      />
    );

    expect(screen.getByRole("link", { name: "Wallet" })).toHaveAttribute("href", "/vault");
    expect(screen.getByRole("link", { name: "Store" })).toHaveAttribute("href", "/vault/store");
    expect(screen.getByRole("link", { name: "Achievements" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Lorewards" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Leaderboards" })).toHaveAttribute(
      "href",
      "/leaderboards"
    );

    const cardsGroup = screen.getByRole("group", { name: "Cards" });
    expect(within(cardsGroup).getByRole("link", { name: "My cards" })).toHaveAttribute(
      "href",
      "/vault/cards/mine"
    );
    expect(within(cardsGroup).getByRole("link", { name: "Sets" })).toHaveAttribute(
      "href",
      "/vault/cards/sets"
    );
    expect(within(cardsGroup).getByRole("link", { name: "Market" })).toHaveAttribute(
      "href",
      "/vault/cards/market"
    );
    expect(within(cardsGroup).getByRole("link", { name: "Explore" })).toHaveAttribute(
      "href",
      "/vault/cards/explore"
    );
    expect(within(cardsGroup).getByRole("link", { name: "Import deck" })).toHaveAttribute(
      "href",
      "/vault/import"
    );
  });
});
