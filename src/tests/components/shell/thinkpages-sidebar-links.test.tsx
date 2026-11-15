import { render, screen, within } from "@testing-library/react";
import { TooltipProvider } from "~/components/ui/tooltip";
import { AppSidebar } from "~/components/shell/AppSidebar";
import { SourceList } from "~/components/shell/SourceList";
import { getApp, getVisibleApps } from "~/lib/navigation/app-sections";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
});

describe("Contextual sidebar disclosure and 1-click collapsed rail", () => {
  const visibleApps = getVisibleApps({ signedIn: true, isAdmin: false, forumModerator: true });
  const thinkpagesApp = visibleApps.find((a) => a.id === "thinkpages")!;
  const vaultApp = getApp("vault");
  const wikiApp = getApp("wiki");

  it("hides child subtabs and expand chevrons across all apps when on an unrelated route", () => {
    render(
      <SourceList
        pathname="/dashboard"
        searchParams={null}
        apps={[thinkpagesApp, vaultApp, wikiApp]}
        expanded={new Set(["thinkpages", "vault", "wiki"])}
        onToggle={() => {}}
        badges={{}}
      />
    );

    expect(screen.getByRole("link", { name: "ThinkPages" })).toHaveAttribute("href", "/thinkpages");
    expect(screen.getByRole("link", { name: "Vault" })).toHaveAttribute("href", "/vault");
    expect(screen.getByRole("link", { name: "Wiki" })).toHaveAttribute("href", "/wiki");

    expect(screen.queryByRole("button", { name: /Expand/i })).toBeNull();
    expect(screen.queryByRole("link", { name: "Forums" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Wallet" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Main page" })).toBeNull();
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

  it("renders every collapsed rail app icon as a 1-click direct link (no two-click Popover buttons)", () => {
    const { container } = render(
      <TooltipProvider>
        <AppSidebar
          pathname="/dashboard"
          searchParams={null}
          apps={[thinkpagesApp, vaultApp, wikiApp]}
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
    expect(within(railNav).getByRole("link", { name: "ThinkPages" })).toHaveAttribute(
      "href",
      "/thinkpages"
    );
    expect(within(railNav).getByRole("link", { name: "Vault" })).toHaveAttribute("href", "/vault");
    expect(within(railNav).getByRole("link", { name: "Wiki" })).toHaveAttribute("href", "/wiki");
    expect(within(railNav).queryAllByRole("button")).toHaveLength(0);
  });

  it("lists the 5 right-sized Vault subtabs and highlights Cards / Achievements across consolidated child routes", () => {
    const { rerender } = render(
      <SourceList
        pathname="/vault/achievements"
        searchParams={new URLSearchParams("tab=lorewards")}
        apps={[vaultApp]}
        expanded={new Set()}
        onToggle={() => {}}
        badges={{}}
      />
    );

    expect(screen.getByRole("link", { name: "Wallet" })).toHaveAttribute("href", "/vault");
    expect(screen.getByRole("link", { name: "Cards" })).toHaveAttribute(
      "href",
      "/vault/cards/mine"
    );
    expect(screen.getByRole("link", { name: "Store" })).toHaveAttribute("href", "/vault/store");
    expect(screen.getByRole("link", { name: "Achievements" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("link", { name: "Leaderboards" })).toHaveAttribute(
      "href",
      "/leaderboards"
    );
    expect(screen.queryByRole("button", { name: /Daily reward/i })).toBeNull();

    rerender(
      <SourceList
        pathname="/vault/cards/sets"
        searchParams={null}
        apps={[vaultApp]}
        expanded={new Set()}
        onToggle={() => {}}
        badges={{}}
      />
    );
    expect(screen.getByRole("link", { name: "Cards" })).toHaveAttribute("aria-current", "page");

    rerender(
      <SourceList
        pathname="/vault/import"
        searchParams={null}
        apps={[vaultApp]}
        expanded={new Set()}
        onToggle={() => {}}
        badges={{}}
      />
    );
    expect(screen.getByRole("link", { name: "Cards" })).toHaveAttribute("aria-current", "page");
  });
});
