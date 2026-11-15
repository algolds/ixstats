import React from "react";
import { render, screen } from "@testing-library/react";
import { NavTray, splitNavTrayApps } from "~/components/halo/views/NavTray";
import { getVisibleApps } from "~/lib/navigation/app-sections";

let mockPathname = "/dashboard";

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

jest.mock("~/context/auth-context", () => ({
  useUser: () => ({ user: { id: "user-1" }, isLoaded: true, isSignedIn: true }),
}));

jest.mock("~/components/providers/FacetMotionConfig", () => ({
  useFacetReducedMotion: () => true,
}));

jest.mock("~/components/ui/pretext", () => ({
  PreText: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

describe("NavTray derived from visibleApps", () => {
  beforeEach(() => {
    mockPathname = "/dashboard";
  });

  it("splits signed-in apps into 6 primary and 3 secondary items while excluding footer apps", () => {
    const apps = getVisibleApps({ signedIn: true, isAdmin: true, canOpenAdmin: true });
    const { primary, secondary } = splitNavTrayApps(apps);

    expect(primary.map((a) => a.label)).toEqual([
      "Home",
      "MyCountry",
      "Maps",
      "Realms",
      "Wiki",
      "ThinkPages",
    ]);
    expect(secondary.map((a) => a.label)).toEqual(["Vault", "Labs", "Help"]);

    render(<NavTray isOpen onClose={jest.fn()} apps={apps} />);
    expect(screen.queryByRole("link", { name: "Admin" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Settings" })).toBeNull();
    expect(screen.getByRole("link", { name: "Vault" })).toBeInTheDocument();
  });

  it("hides disabled navigationSettings tabs and omits the secondary bar when 6 or fewer apps remain", () => {
    const apps = getVisibleApps({
      signedIn: true,
      isAdmin: false,
      hasLabsAccess: false,
      navigationSettings: {
        showMapsTab: false,
        showLabsTab: false,
        showHelpTab: false,
      },
    });

    const { container } = render(<NavTray isOpen onClose={jest.fn()} apps={apps} />);
    expect(screen.queryByRole("link", { name: "Maps" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Labs" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Help" })).toBeNull();
    expect(container.querySelector(".border-t")).toBeNull();
  });

  it("highlights the owning app via getVisibleAppForPath on sub-routes like /util/recent-changes and /exchange", () => {
    const apps = getVisibleApps({ signedIn: true, isAdmin: false, hasLabsAccess: true });

    mockPathname = "/util/recent-changes";
    const { rerender } = render(<NavTray isOpen onClose={jest.fn()} apps={apps} />);
    expect(screen.getByRole("link", { name: "Wiki" })).toHaveAttribute("aria-current", "page");

    mockPathname = "/exchange";
    rerender(<NavTray isOpen onClose={jest.fn()} apps={apps} />);
    expect(screen.getByRole("link", { name: "Labs" })).toHaveAttribute("aria-current", "page");
  });
});
