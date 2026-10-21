/** NationStates imports: start a region sync, control running syncs, run the CTE filter, read the history. */
import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";

jest.mock("~/hooks/useNotify", () => {
  const notify = { success: jest.fn(), error: jest.fn() };
  return { useNotify: () => notify };
});

import { api } from "~/trpc/react";
import { NsImports } from "~/app/admin/cards/imports/ns";

const ns = api.cards.admin.nationstates;
const mutation = (mutate: jest.Mock, extra: object = {}) =>
  ({ mutate, isPending: false, ...extra }) as never;
const start = jest.fn();
const pause = jest.fn();
const resume = jest.fn();
const stop = jest.fn();
const discover = jest.fn();
const filterCte = jest.fn();

const sync = (overrides: object) => ({
  id: "log_a",
  region: "Lazarus",
  status: "IN_PROGRESS",
  stalled: false,
  processed: 10,
  totalCards: 40,
  cardsCreated: 6,
  cardsUpdated: 4,
  startedAt: new Date(),
  ...overrides,
});

const log = (overrides: object) => ({
  id: "log_h",
  syncType: "NS_REGION_BALDER",
  region: "Balder",
  status: "SUCCESS",
  cardsCreated: 12,
  cardsUpdated: 3,
  itemsProcessed: 15,
  errorMessage: null,
  startedAt: new Date(),
  completedAt: new Date(),
  ...overrides,
});

function serve({
  active = [] as object[],
  logs = [] as object[],
  logCards = undefined as object | undefined,
  found = undefined as object[] | undefined,
  pausing = undefined as string | undefined,
} = {}) {
  jest.mocked(api.useUtils).mockReturnValue({
    cards: {
      admin: {
        nationstates: { active: { invalidate: jest.fn() }, logs: { invalidate: jest.fn() } },
      },
    },
  } as never);
  jest.mocked(ns.active.useQuery).mockReturnValue({ data: active } as never);
  jest.mocked(ns.logs.useQuery).mockReturnValue({ data: logs } as never);
  jest.mocked(ns.logCards.useQuery).mockReturnValue({ data: logCards } as never);
  jest.mocked(ns.start.useMutation).mockReturnValue(mutation(start));
  jest
    .mocked(ns.pause.useMutation)
    .mockReturnValue(
      mutation(pause, pausing ? { isPending: true, variables: { syncLogId: pausing } } : {})
    );
  jest.mocked(ns.resume.useMutation).mockReturnValue(mutation(resume));
  jest.mocked(ns.stop.useMutation).mockReturnValue(mutation(stop));
  jest
    .mocked(ns.discoverRegions.useMutation)
    .mockReturnValue(mutation(discover, { data: found, isSuccess: found !== undefined }));
  jest.mocked(ns.filterCte.useMutation).mockReturnValue(mutation(filterCte));
}

beforeEach(() => jest.clearAllMocks());

describe("NsImports", () => {
  it("starts a sync of the named regions and seasons, and pauses a running one", () => {
    serve({ active: [sync({})] });
    render(<NsImports />);
    fireEvent.change(screen.getByLabelText("Regions, one per line"), {
      target: { value: "Lazarus\n The North Pacific \n" },
    });
    fireEvent.change(screen.getByLabelText("Seasons"), { target: { value: "1-3" } });
    fireEvent.click(screen.getByRole("button", { name: "Start sync" }));
    expect(start).toHaveBeenCalledWith({
      regions: ["Lazarus", "The North Pacific"],
      seasons: [1, 2, 3],
    });

    expect(screen.getByText("10 of 40")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(pause).toHaveBeenCalledWith({ syncLogId: "log_a" });
  });

  it("starts nothing without a region", () => {
    serve();
    render(<NsImports />);
    expect(screen.getByRole("button", { name: "Start sync" })).toBeDisabled();
    expect(screen.getByText("No sync running")).toBeInTheDocument();
  });

  it("resumes or stops a paused sync, and says when a sync is still reading the dumps", () => {
    serve({
      active: [
        sync({ status: "PAUSED" }),
        sync({ id: "log_b", region: "Balder", processed: 0, totalCards: 0 }),
      ],
    });
    render(<NsImports />);
    expect(screen.getByText("Paused")).toBeInTheDocument();
    expect(screen.getByText("Reading the card dumps")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    expect(resume).toHaveBeenCalledWith({ syncLogId: "log_a" });
    fireEvent.click(screen.getAllByRole("button", { name: "Stop" })[1]!);
    expect(stop).toHaveBeenCalledWith({ syncLogId: "log_b" });
  });

  it("offers Resume beside Pause on a sync whose run has stalled", () => {
    serve({ active: [sync({ stalled: true })] });
    render(<NsImports />);
    expect(screen.getByText("Stalled")).toBeInTheDocument();
    expect(screen.queryByText("Running")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    expect(resume).toHaveBeenCalledWith({ syncLogId: "log_a" });
    expect(screen.getByRole("button", { name: "Pause" })).toBeEnabled();
  });

  it("offers no Resume on a sync that is running", () => {
    serve({ active: [sync({})] });
    render(<NsImports />);
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resume" })).not.toBeInTheDocument();
  });

  it("disables a sync's buttons while a request for it is pending, and only that sync's", () => {
    serve({
      active: [sync({ stalled: true }), sync({ id: "log_b", region: "Balder" })],
      pausing: "log_a",
    });
    render(<NsImports />);
    const [lazarus, balder] = screen.getAllByRole("row").slice(1);
    for (const button of within(lazarus!).getAllByRole("button")) expect(button).toBeDisabled();
    for (const button of within(balder!).getAllByRole("button")) expect(button).toBeEnabled();
  });

  it("finds large regions by tag and adds one to the list", () => {
    serve({ found: [{ id: "lazarus", name: "Lazarus", numnations: 12000 }] });
    render(<NsImports />);
    fireEvent.change(screen.getByLabelText("Find large regions by tag"), {
      target: { value: "massive" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Find" }));
    expect(discover).toHaveBeenCalledWith({ tag: "massive", limit: 15 });
    expect(screen.getByText("12,000 nations")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add Lazarus" }));
    expect(screen.getByLabelText("Regions, one per line")).toHaveValue("Lazarus");
  });

  it("says so when no region has the tag", () => {
    serve({ found: [] });
    render(<NsImports />);
    expect(screen.getByText("No region has that tag.")).toBeInTheDocument();
  });

  it("runs the CTE filter", () => {
    serve();
    render(<NsImports />);
    fireEvent.click(screen.getByRole("button", { name: "Run the CTE filter" }));
    expect(filterCte).toHaveBeenCalled();
  });

  it("lists every run, and the cards a region sync created", () => {
    serve({
      logs: [
        log({}),
        log({
          id: "cte",
          syncType: "NS_CTE_FILTER",
          region: null,
          cardsCreated: 0,
          cardsUpdated: 0,
          itemsProcessed: 68191,
        }),
        log({ id: "bad", status: "FAILED", errorMessage: "Stopped by an admin" }),
        log({ id: "dump", syncType: "NS_SEASON_DUMP_1", region: null, status: "QUEUED" }),
      ],
      logCards: {
        exact: true,
        total: 1,
        cards: [
          {
            id: "c1",
            title: "Elm",
            rarity: "ULTRA_RARE",
            nsCardId: 1,
            nsSeason: 3,
            reviewState: "PENDING",
          },
        ],
      },
    });
    render(<NsImports />);
    expect(screen.getByText("CTE filter")).toBeInTheDocument();
    expect(screen.getByText("68,191 cards checked")).toBeInTheDocument();
    expect(screen.getByText("Stopped by an admin")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("NS_SEASON_DUMP_1")).toBeInTheDocument();
    expect(screen.getByText("QUEUED")).toBeInTheDocument();
    // Runs that are not region syncs make no cards, so they show no counts and no card list
    expect(screen.getAllByText("–")).toHaveLength(4);
    expect(screen.getAllByRole("button", { name: "Cards" })).toHaveLength(2);

    fireEvent.click(screen.getAllByRole("button", { name: "Cards" })[0]!);
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByText("Cards from Balder")).toBeInTheDocument();
    expect(within(sheet).getByText("Ultra rare")).toBeInTheDocument();
    expect(within(sheet).getByText("Waiting for review")).toBeInTheDocument();
    expect(jest.mocked(ns.logCards.useQuery).mock.calls.at(-1)).toEqual([
      { syncLogId: "log_h", search: undefined, limit: 50, offset: 0 },
      { enabled: true },
    ]);
  });

  it("says when a sync's cards come from before syncs recorded their own", () => {
    serve({ logs: [log({})], logCards: { exact: false, total: 0, cards: [] } });
    render(<NsImports />);
    fireEvent.click(screen.getByRole("button", { name: "Cards" }));
    const sheet = screen.getByRole("dialog");
    expect(
      within(sheet).getByText(/every card first synced from this region/i)
    ).toBeInTheDocument();
    expect(within(sheet).getByText("No cards found")).toBeInTheDocument();
  });

  it("searches a sync's cards once typing pauses", () => {
    jest.useFakeTimers();
    try {
      serve({ logs: [log({})], logCards: { exact: true, total: 0, cards: [] } });
      render(<NsImports />);
      fireEvent.click(screen.getByRole("button", { name: "Cards" }));
      fireEvent.change(screen.getByLabelText("Search cards"), { target: { value: " elm " } });
      const logCards = jest.mocked(ns.logCards.useQuery);
      expect(logCards.mock.calls.at(-1)?.[0]).toMatchObject({ search: undefined });
      act(() => jest.advanceTimersByTime(300));
      expect(logCards.mock.calls.at(-1)?.[0]).toMatchObject({ syncLogId: "log_h", search: "elm" });
      expect(screen.getByText("No card matches that search.")).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it("starts at most 20 regions at a time", () => {
    serve();
    render(<NsImports />);
    const regions = Array.from({ length: 21 }, (_, i) => `Region ${i}`).join("\n");
    fireEvent.change(screen.getByLabelText("Regions, one per line"), {
      target: { value: regions },
    });
    expect(screen.getByText(/At most 20 regions at a time/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start sync" })).toBeDisabled();
  });
});
