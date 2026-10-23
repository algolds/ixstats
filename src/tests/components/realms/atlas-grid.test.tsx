import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { AtlasGrid } from "~/app/realms/_components/AtlasGrid";
import type { DirectoryRealm } from "~/app/realms/_components/realm-directory";

let mockIsAdmin = false;

jest.mock("~/hooks/usePermissions", () => ({ useIsAdmin: () => mockIsAdmin }));

jest.mock("~/components/realms/RealmCard", () => ({
  RealmCard: ({ realm }: { realm: { name: string } }) => <li>{realm.name}</li>,
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: ReactNode;
    className?: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const BASE: DirectoryRealm = {
  id: "r",
  slug: "r",
  name: "R",
  description: null,
  thumbnail: null,
  bannerUrl: null,
  tags: [],
  foundedAt: new Date("2026-01-01T00:00:00Z"),
  nationCount: 10,
  openNationCount: 0,
  openNationPageCount: 0,
  myNationCount: 0,
  maxNationsPerUser: 3,
  board: { recentPosts: 0, lastPostAt: null },
  boardMessagesThisWeek: 0,
};

const realm = (name: string, over: Partial<DirectoryRealm> = {}): DirectoryRealm => ({
  ...BASE,
  id: name,
  slug: name.toLowerCase(),
  name,
  ...over,
});

const IXNAY = realm("Ixnay", { openNationCount: 3, tags: ["Roleplay"], description: "Deep lore." });
const EURTH = realm("Eurth", { openNationCount: 9, tags: ["Historical"] });
const SIX = ["A", "B", "C", "D", "E", "F"].map((n) => realm(n, { tags: ["Roleplay"] }));

describe("AtlasGrid", () => {
  beforeEach(() => {
    mockIsAdmin = false;
  });

  it("orders realms most open first", () => {
    render(<AtlasGrid realms={[IXNAY, EURTH]} isLoading={false} query="" />);
    const names = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(names.indexOf("Eurth")).toBeLessThan(names.indexOf("Ixnay"));
    expect(names.indexOf("Eurth")).toBeGreaterThanOrEqual(0);
  });

  it("hides sort and tags below six realms", () => {
    const { unmount } = render(<AtlasGrid realms={[IXNAY, EURTH]} isLoading={false} query="" />);
    expect(screen.queryByRole("combobox", { name: "Sort realms" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Filter by tag")).not.toBeInTheDocument();
    unmount();
    render(<AtlasGrid realms={SIX} isLoading={false} query="" />);
    expect(screen.getByRole("combobox", { name: "Sort realms" })).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by tag")).toBeInTheDocument();
  });

  it("filters by the search query", () => {
    render(<AtlasGrid realms={[IXNAY, EURTH]} isLoading={false} query="lore" />);
    expect(screen.getByText("Ixnay")).toBeInTheDocument();
    expect(screen.queryByText("Eurth")).not.toBeInTheDocument();
  });

  it("says when nothing matches and hides the tile", () => {
    render(<AtlasGrid realms={[IXNAY, EURTH]} isLoading={false} query="zzz" />);
    expect(screen.getByText("No realm matches “zzz”.")).toBeInTheDocument();
    expect(screen.queryByText("Found a realm")).not.toBeInTheDocument();
    expect(screen.queryByText("Bring your realm")).not.toBeInTheDocument();
  });

  it("admins found a realm in Studio", () => {
    mockIsAdmin = true;
    render(<AtlasGrid realms={[IXNAY]} isLoading={false} query="" />);
    expect(screen.getByRole("link", { name: "Found a realm" })).toHaveAttribute(
      "href",
      "/admin/maps/studio"
    );
    expect(
      screen.getByText("Start a world in Studio, with its map, board and factbook.")
    ).toBeInTheDocument();
  });

  it("players bring a realm to the Find a Realm board", () => {
    render(<AtlasGrid realms={[IXNAY]} isLoading={false} query="" />);
    expect(screen.getByRole("link", { name: "Bring your realm" })).toHaveAttribute(
      "href",
      "/thinkpages/c/find-a-realm"
    );
    expect(
      screen.getByText("Run a community with its own world? Post it on the Find a Realm board.")
    ).toBeInTheDocument();
  });

  it("shows three skeletons while loading", () => {
    render(<AtlasGrid realms={undefined} isLoading query="" />);
    const loading = screen.getByLabelText("Loading realms");
    expect(loading.children).toHaveLength(3);
  });

  it("labels the section and anchors it", () => {
    const { container } = render(<AtlasGrid realms={[IXNAY]} isLoading={false} query="" />);
    expect(container.querySelector("section#atlas")).toHaveAttribute("aria-label", "Realms");
  });
});
