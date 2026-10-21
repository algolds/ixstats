import "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { SourceList } from "~/components/shell/SourceList";
import { getVisibleApps, type NavBadges } from "~/lib/navigation/app-sections";

const apps = getVisibleApps({
  signedIn: true,
  isAdmin: true,
  hasLabsAccess: true,
  navigationSettings: undefined,
});

function setup(pathname: string, opts: { expanded?: string[]; badges?: NavBadges } = {}) {
  const onToggle = jest.fn();
  const onAction = jest.fn();
  const onNavigate = jest.fn();
  render(
    <SourceList
      pathname={pathname}
      searchParams={null}
      apps={apps}
      expanded={new Set(opts.expanded ?? [])}
      onToggle={onToggle}
      badges={opts.badges ?? {}}
      onAction={onAction}
      onNavigate={onNavigate}
    />
  );
  return {
    onToggle,
    onAction,
    onNavigate,
    nav: screen.getByRole("navigation", { name: "App navigation" }),
  };
}

describe("SourceList external sections", () => {
  it("opens the Discord invite in a new tab without opener access and never marks it current", () => {
    const { nav, onNavigate } = setup("/help", { expanded: ["help"] });
    const link = within(nav).getByRole("link", { name: "Ixnay Discord" });
    expect(link).toHaveAttribute("href", "https://discord.gg/mgXAEYdqkd");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).not.toHaveAttribute("aria-current");
    fireEvent.click(link);
    expect(onNavigate).toHaveBeenCalled();
  });
});
