/** The country document: one face, the ribbon, one panel per tab, URLs per tab, and the owner flip. */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { CountryDocument } from "~/app/countries/[slug]/_components/CountryDocument";
import {
  ProfileShellProvider,
  type ProfileShellValue,
} from "~/app/countries/[slug]/_components/ProfileShellContext";

// The address the router sees (null outside the app router, as before these tests).
let mockPathname: string | null = null;
jest.mock("next/navigation", () => ({ usePathname: () => mockPathname }));

jest.mock("~/app/countries/[slug]/_hooks/useCountryProfileLayer", () => ({
  useCountryProfileLayer: () => ({ countryId: "c1", slug: "caphiria", owner: null }),
}));
jest.mock("~/hooks/useUserCountry", () => ({ useUserCountry: () => ({ userProfile: null }) }));
jest.mock("~/components/mycountry/dossier/CountryActionsMenu", () => ({
  CountryActionsMenu: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div role="dialog" aria-label="Country actions menu" /> : null,
}));
jest.mock("~/components/country-profile/ProfileFace", () => ({
  ProfileFace: ({ action, onExpandMap }: { action: React.ReactNode; onExpandMap: () => void }) => (
    <div>
      {action}
      <button type="button" onClick={onExpandMap}>
        Open the map
      </button>
    </div>
  ),
}));
jest.mock("~/components/country-profile/factbook/FactbookTab", () => ({
  FactbookTab: () => <p>Factbook panel</p>,
}));
jest.mock("~/components/country-profile/map/MapTab", () => ({ MapTab: () => <p>Map panel</p> }));
jest.mock("~/components/country-profile/lore/LoreReader", () => ({
  LoreReader: () => <p>Lore panel</p>,
}));
jest.mock("~/components/country-profile/history/HistoryTab", () => ({
  HistoryTab: () => <p>History panel</p>,
}));

function shell(isOwner = false): ProfileShellValue {
  return {
    slug: "caphiria",
    country: { id: "c1", name: "Caphiria" } as ProfileShellValue["country"],
    flagUrl: null,
    isOwner,
    currentIxTime: 0,
    cover: { mode: "gradient", url: null, onChange: isOwner ? jest.fn() : undefined },
  };
}

function setup(initialTab: "factbook" | "map" | "lore" | "history" = "factbook", isOwner = false) {
  return render(
    <ProfileShellProvider value={shell(isOwner)}>
      <CountryDocument initialTab={initialTab} />
    </ProfileShellProvider>
  );
}

beforeEach(() => {
  mockPathname = null;
  window.history.replaceState(null, "", "/countries/caphiria");
  Element.prototype.scrollIntoView = jest.fn();
});

describe("CountryDocument", () => {
  it("lets the address win over the page's own tab (a Back across a soft navigation)", () => {
    mockPathname = "/countries/caphiria/history";
    setup("factbook");
    expect(screen.getByText("History panel")).toBeInTheDocument();
  });

  it("follows the address when a link changes it under the mounted page", () => {
    mockPathname = "/countries/caphiria/history";
    const { rerender } = setup("history");
    mockPathname = "/countries/caphiria";
    rerender(
      <ProfileShellProvider value={shell()}>
        <CountryDocument initialTab="history" />
      </ProfileShellProvider>
    );
    expect(screen.getByRole("tab", { name: "Factbook" })).toHaveAttribute("aria-selected", "true");
  });

  it("opens on its initial tab", () => {
    setup("lore");
    expect(screen.getByText("Lore panel")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Lore" })).toHaveAttribute("aria-selected", "true");
  });

  it("switches tabs in place and gives each its own URL", async () => {
    const push = jest.spyOn(window.history, "pushState");
    setup();
    fireEvent.click(screen.getByRole("tab", { name: "Map" }));
    expect(await screen.findByText("Map panel")).toBeInTheDocument();
    expect(push).toHaveBeenLastCalledWith(null, "", "/countries/caphiria/map");
    push.mockRestore();
  });

  it("follows the back button", async () => {
    setup();
    act(() => {
      window.history.pushState(null, "", "/countries/caphiria/history");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(await screen.findByText("History panel")).toBeInTheDocument();
  });

  it("sends the hero map's expand to the Map tab", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Open the map" }));
    expect(await screen.findByText("Map panel")).toBeInTheDocument();
  });

  it("gives visitors Country actions", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Country actions" }));
    expect(screen.getByRole("dialog", { name: "Country actions menu" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Manage" })).toBeNull();
  });

  it("links the owner's back face to MyCountry and the editor", () => {
    setup("factbook", true);
    fireEvent.click(screen.getByRole("button", { name: "Manage" }));
    expect(screen.getByRole("link", { name: "Open MyCountry" })).toHaveAttribute("href", "/mycountry");
    expect(screen.getByRole("link", { name: "Edit country" })).toHaveAttribute(
      "href",
      "/mycountry/editor"
    );
  });

  it("lets the owner flip the face to manage it, and returns focus on Done", () => {
    setup("factbook", true);
    const manage = screen.getByRole("button", { name: "Manage" });
    fireEvent.click(manage);
    const done = screen.getByRole("button", { name: "Done" });
    expect(done.closest("[inert]")).toBeNull();
    expect(manage.closest("[inert]")).not.toBeNull();
    fireEvent.click(done);
    expect(manage).toHaveFocus();
  });
});
