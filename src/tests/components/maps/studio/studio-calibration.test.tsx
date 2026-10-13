/**
 * The Calibration tab: the generated world's measures (taken by the worker, again for each new world) beside one or
 * two realms' (Ixnay and Eurth to start, any realm on request), each figure with its gap and one distance per realm,
 * and a realm that cannot be measured saying why while the others still show.
 */
import { fireEvent, screen, waitFor, within } from "@testing-library/react";

jest.mock("~/trpc/react", () => ({ api: { useQueries: jest.fn() } }));
jest.mock("~/components/ui/value-select", () =>
  jest.requireActual("~/tests/helpers/native-value-select")
);

import { StudioCalibrationTab } from "~/components/maps/studio/StudioCalibrationTab";
import { api } from "~/trpc/react";
import { worldResult } from "~/tests/helpers/fake-world-worker";
import {
  IXNAY_MEASURES,
  MEASURES,
  renderTab,
  studioValue,
} from "~/tests/helpers/studio-tab-fixtures";

type RealmAnswer = { data: object } | { isError: true; error: Error } | Record<string, never>;

/** What the server answers per realm slug; a realm not listed is still loading. */
let answers: Record<string, RealmAnswer>;
const asked: string[][] = [];

beforeEach(() => {
  asked.length = 0;
  answers = {
    ixnay: {
      data: {
        ok: true,
        realm: { id: "r_ixnay", slug: "ixnay", name: "Ixnay" },
        mapVersion: 5,
        measures: IXNAY_MEASURES,
      },
    },
    eurth: { data: { ok: false, reason: "This realm has no map layers to measure." } },
  };
  jest
    .mocked(api.useQueries as unknown as jest.Mock)
    .mockImplementation((build: (t: unknown) => { realm: string }[]) => {
      const t = {
        atlas: { studio: { realmMeasures: (input: { realm: string }) => input } },
      };
      const inputs = build(t);
      asked.push(inputs.map((input) => input.realm));
      return inputs.map((input) => answers[input.realm] ?? {});
    });
});

const cell = (row: string, column: number) =>
  within(screen.getByRole("row", { name: new RegExp(`^${row}`) })).getAllByRole("cell")[column]!;

describe("Studio Calibration tab", () => {
  it("measures the world in the worker and shows it beside Ixnay, with the gap and a distance", async () => {
    const value = studioValue();
    renderTab(<StudioCalibrationTab />, value);
    await screen.findByText("31.2%");

    expect(value.generator.measure).toHaveBeenCalledTimes(1);
    // Ixnay and Eurth are the first two realms compared with
    expect(asked.at(-1)).toEqual(["ixnay", "eurth"]);
    expect(cell("Land share", 0)).toHaveTextContent("31.2%");
    expect(cell("Land share", 1)).toHaveTextContent("22.0%");
    expect(cell("Land share", 1)).toHaveTextContent("+9.2 pts");
    expect(cell("Nations", 1)).toHaveTextContent("183");
    expect(cell("Nations", 1)).toHaveTextContent("-53");
    expect(cell("Coastline", 1)).toHaveTextContent("669k km");
    expect(screen.getByText(/^Distance \d+$/)).toBeInTheDocument();
  });

  it("shows a realm that cannot be measured with its reason, and still the others", async () => {
    renderTab(<StudioCalibrationTab />);
    await screen.findByText("31.2%");
    const heading = screen.getByRole("columnheader", { name: /Eurth/ });
    expect(heading).toHaveTextContent("This realm has no map layers to measure.");
    expect(within(heading).queryByText(/Distance/)).toBeNull();
    // Ixnay's column is whole
    expect(screen.getByRole("columnheader", { name: /Ixnay/ })).toHaveTextContent(/Distance \d+/);
    expect(cell("Land share", 2)).toHaveTextContent("-");
  });

  it("says a realm's measurement failed, as an alert", async () => {
    answers.ixnay = { isError: true, error: new Error("Server went away") };
    renderTab(<StudioCalibrationTab />);
    await screen.findByText("31.2%");
    expect(screen.getByRole("alert")).toHaveTextContent("Server went away");
  });

  it("draws the elevation and climate bars for the world and each measured realm", async () => {
    renderTab(<StudioCalibrationTab />);
    await screen.findByText("31.2%");
    const elevation = screen.getByRole("region", { name: "Land by elevation" });
    expect(within(elevation).getAllByRole("listitem")).not.toHaveLength(0);
    expect(
      within(elevation).getByRole("listitem", {
        name: /^Coastal Lowlands: World 40\.0%, Ixnay 47\.1%$/,
      })
    ).toBeInTheDocument();
    const climate = screen.getByRole("region", { name: "Climate of the classified land" });
    expect(
      within(climate).getByRole("listitem", { name: /^Tropical: World 20\.0%, Ixnay 25\.4%$/ })
    ).toBeInTheDocument();
  });

  it("names the land with no climate group only when there is some", async () => {
    const { unmount } = renderTab(<StudioCalibrationTab />);
    await screen.findByText("31.2%");
    expect(screen.queryByText(/no climate group/)).toBeNull();
    unmount();

    const value = studioValue();
    jest
      .mocked(value.generator.measure)
      .mockResolvedValue({ ...MEASURES, unclassifiedShare: 0.12 });
    renderTab(<StudioCalibrationTab />, value);
    expect(await screen.findByText(/Land with no climate group/)).toHaveTextContent("World 12.0%");
  });

  it("compares with any realm chosen, and with none", async () => {
    answers.shell = {
      data: {
        ok: true,
        realm: { id: "r_shell", slug: "shell", name: "Shell" },
        mapVersion: 1,
        measures: { ...IXNAY_MEASURES, landShare: 0.5 },
      },
    };
    renderTab(<StudioCalibrationTab />);
    await screen.findByText("31.2%");
    fireEvent.change(screen.getByRole("combobox", { name: "Second realm to compare with" }), {
      target: { value: "shell" },
    });
    expect(asked.at(-1)).toEqual(["ixnay", "shell"]);
    expect(cell("Land share", 2)).toHaveTextContent("50.0%");

    fireEvent.change(screen.getByRole("combobox", { name: "Second realm to compare with" }), {
      target: { value: "none" },
    });
    expect(asked.at(-1)).toEqual(["ixnay"]);
    expect(screen.queryByRole("columnheader", { name: /Shell/ })).toBeNull();
  });

  it("measures again when a new world lands", async () => {
    const value = studioValue();
    const view = renderTab(<StudioCalibrationTab />, value);
    await screen.findByText("31.2%");

    const measure = jest.fn().mockResolvedValue({ ...MEASURES, landShare: 0.4 });
    view.rerenderWith(
      studioValue({ generator: { ...value.generator, result: worldResult({ seed: 8 }), measure } })
    );
    await waitFor(() => expect(cell("Land share", 0)).toHaveTextContent("40.0%"));
    expect(measure).toHaveBeenCalledTimes(1);
  });

  it("waits quietly for a request the world outran, and says a real failure with a way to try again", async () => {
    const value = studioValue();
    jest
      .mocked(value.generator.measure)
      .mockRejectedValueOnce(new Error("The world changed before the answer came"))
      .mockRejectedValueOnce(new Error("Out of memory"))
      .mockResolvedValue(MEASURES);
    const view = renderTab(<StudioCalibrationTab />, value);
    expect(await screen.findByText("Measuring the world.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();

    // The next world's answer is a real failure
    view.rerenderWith(
      studioValue({ generator: { ...value.generator, result: worldResult({ seed: 9 }) } })
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Out of memory");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("31.2%")).toBeInTheDocument();
  });

  it("measures nothing and says so while there is no world, and marks figures that are out of date", async () => {
    const value = studioValue();
    const none = studioValue({ generator: { ...value.generator, result: null, state: "idle" } });
    const view = renderTab(<StudioCalibrationTab />, none);
    expect(screen.getByText("There is no world to measure yet.")).toBeInTheDocument();
    expect(none.generator.measure).not.toHaveBeenCalled();

    view.rerenderWith(value);
    await screen.findByText("31.2%");
    view.rerenderWith(studioValue({ generator: value.generator, stale: true }));
    expect(screen.getByText(/being made again/)).toBeInTheDocument();
  });

  it("notes that a fitted world keeps the realm's borders", async () => {
    renderTab(
      <StudioCalibrationTab />,
      studioValue({ source: { kind: "fit", preset: "earthlike", realm: "ixnay" } })
    );
    expect(await screen.findByText(/keeps that realm's borders/)).toBeInTheDocument();
  });
});
