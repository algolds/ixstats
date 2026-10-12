/**
 * The Realms tab: a row per realm with its figures, problem chips, sorting, filters and the link to the realm page.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { realmRow, resetFakeAtlas, state } from "~/tests/helpers/fake-atlas-ui";

jest.mock("~/trpc/react", () => ({ api: jest.requireActual("~/tests/helpers/fake-atlas-ui").api }));
const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { AtlasRealmsTab } from "~/app/admin/maps/_components/atlas/AtlasRealmsTab";

const names = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[0]!.textContent);

beforeEach(() => {
  resetFakeAtlas();
  push.mockClear();
  state.overview = {
    partial: false,
    realms: [
      realmRow({
        id: "r_b",
        slug: "borea",
        name: "Borea",
        status: "draft",
        layers: { present: 3, total: 7, missing: ["rivers"] },
        flags: ["missing-layers", "relief", "unlinked"],
        relief: "failed",
        linkage: { linked: 1, total: 4 },
      }),
      realmRow({
        id: "r_a",
        slug: "alba",
        name: "Alba",
        status: "active",
        nations: { total: 30, owned: 20, open: 9, reserved: 1 },
        pendingClaims: 2,
        lastJob: {
          id: "j",
          kind: "world",
          status: "failed",
          dryRun: false,
          at: new Date(Date.now() - 3600_000),
        },
        flags: ["last-job-failed"],
      }),
      realmRow({
        id: "r_c",
        slug: "caldera",
        name: "Caldera",
        status: "active",
        relief: "unknown",
      }),
    ],
  };
});

describe("the Realms tab rows", () => {
  it("shows each realm's figures", () => {
    render(<AtlasRealmsTab />);
    const alba = screen.getByRole("link", { name: "Alba" }).closest("tr")!;
    expect(within(alba).getByText("7 of 7")).toBeInTheDocument();
    expect(within(alba).getByText("30")).toBeInTheDocument();
    expect(within(alba).getByText("20 owned, 9 open, 1 reserved")).toBeInTheDocument();
    expect(within(alba).getByText("World apply")).toBeInTheDocument();
    expect(within(alba).getByText("Failed")).toBeInTheDocument();
    const borea = screen.getByRole("link", { name: "Borea" }).closest("tr")!;
    expect(within(borea).getByText("3 of 7")).toBeInTheDocument();
    expect(within(borea).getByText("1 of 4")).toBeInTheDocument();
    expect(within(borea).getByText("Failed", { selector: "td" })).toBeInTheDocument();
  });

  it("shows relief unknown as unknown", () => {
    render(<AtlasRealmsTab />);
    const caldera = screen.getByRole("link", { name: "Caldera" }).closest("tr")!;
    expect(within(caldera).getByText("Unknown")).toBeInTheDocument();
  });

  it("shows the problems as chips", () => {
    render(<AtlasRealmsTab />);
    const borea = screen.getByRole("link", { name: "Borea" }).closest("tr")!;
    expect(within(borea).getByText("Missing layers")).toBeInTheDocument();
    expect(within(borea).getByText("Relief failed")).toBeInTheDocument();
    expect(within(borea).getByText("Unlinked features")).toBeInTheDocument();
    expect(
      within(screen.getByRole("link", { name: "Alba" }).closest("tr")!).getByText("Last job failed")
    ).toBeInTheDocument();
  });

  it("opens the realm page from the link and from the row", () => {
    render(<AtlasRealmsTab />);
    expect(screen.getByRole("link", { name: "Alba" })).toHaveAttribute(
      "href",
      "/admin/maps/realms/alba"
    );
    fireEvent.click(screen.getByRole("link", { name: "Borea" }).closest("tr")!);
    expect(push).toHaveBeenCalledWith("/admin/maps/realms/borea");
  });
});

describe("sorting and filtering", () => {
  it("sorts by name, then by a column, and reverses on a second click", () => {
    render(<AtlasRealmsTab />);
    expect(names()[0]).toContain("Alba");
    fireEvent.click(screen.getByRole("button", { name: "Layers" }));
    expect(names()[0]).toContain("Borea");
    fireEvent.click(screen.getByRole("button", { name: "Layers" }));
    expect(names()[2]).toContain("Borea");
    expect(screen.getByRole("columnheader", { name: "Layers" })).toHaveAttribute(
      "aria-sort",
      "descending"
    );
  });

  it("sorts by nations", () => {
    render(<AtlasRealmsTab />);
    fireEvent.click(screen.getByRole("button", { name: "Nations" }));
    fireEvent.click(screen.getByRole("button", { name: "Nations" }));
    expect(names()[0]).toContain("Alba");
  });

  it("shows only realms with problems", () => {
    render(<AtlasRealmsTab />);
    fireEvent.click(screen.getByRole("switch", { name: "Has problems" }));
    expect(names().map((name) => name?.replace(/(active|draft)$/, ""))).toEqual(["Alba", "Borea"]);
  });

  it("filters by status", () => {
    render(<AtlasRealmsTab />);
    fireEvent.click(screen.getByRole("combobox", { name: "Realm status" }));
    fireEvent.click(screen.getByRole("option", { name: "draft" }));
    expect(names()).toHaveLength(1);
    expect(names()[0]).toContain("Borea");
  });

  it("says when nothing matches", () => {
    state.overview = { partial: false, realms: [realmRow()] };
    render(<AtlasRealmsTab />);
    fireEvent.click(screen.getByRole("switch", { name: "Has problems" }));
    expect(screen.getByText("No realms match")).toBeInTheDocument();
  });
});

describe("the realms read error", () => {
  it("shows the server's message", () => {
    state.readErrors.overview = "Realms are down";
    render(<AtlasRealmsTab />);
    expect(screen.getByText("Realms are down")).toBeInTheDocument();
  });
});
