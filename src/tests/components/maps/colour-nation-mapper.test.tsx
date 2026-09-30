import { fireEvent, render, screen, within } from "@testing-library/react";
import { ColourNationMapper } from "~/app/admin/maps/_components/ColourNationMapper";
import { rankColours } from "~/lib/maps/png-realm-map";

// The nation picker's suggestion list (cmdk) measures itself; jsdom has neither API.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= () => {};
});

const colours = rankColours([
  { hex: "#00ff00", pixelCount: 20 },
  { hex: "#0000ff", pixelCount: 50 },
  { hex: "#ff0000", pixelCount: 30 },
]);

function renderMapper(onVectorise = jest.fn()) {
  render(
    <ColourNationMapper
      colours={colours}
      nationNames={["Aurelia", "Borealis"]}
      namesLoading={false}
      busy={false}
      onVectorise={onVectorise}
    />
  );
  return onVectorise;
}

const row = (hex: string) => screen.getByTestId(`colour-${hex.slice(1)}`);
const nationInput = (hex: string) => within(row(hex)).getByPlaceholderText("Nation…");
const vectorise = () => screen.getByRole("button", { name: /vectorise/i });

describe("ColourNationMapper", () => {
  it("lists the detected colours largest first with their pixel share", () => {
    renderMapper();
    const rows = screen.getAllByTestId(/^colour-/);
    expect(rows.map((r) => r.dataset.testid)).toEqual([
      "colour-0000ff",
      "colour-ff0000",
      "colour-00ff00",
    ]);
    expect(within(row("#0000ff")).getByText("50.0%")).toBeInTheDocument();
  });

  it("vectorises only named, non-ignored colours and shows how many are dropped", () => {
    const onVectorise = renderMapper();
    expect(vectorise()).toBeDisabled();

    fireEvent.change(nationInput("#ff0000"), { target: { value: "Aurelia" } });
    fireEvent.click(within(row("#0000ff")).getByRole("checkbox", { name: /ignore/i }));

    expect(screen.getByText(/1 unmapped colour will be dropped/i)).toBeInTheDocument();
    fireEvent.click(vectorise());
    expect(onVectorise).toHaveBeenCalledWith({ "#ff0000": "Aurelia" }, 1);
  });

  it("refuses to vectorise while one nation holds two colours", () => {
    renderMapper();
    fireEvent.change(nationInput("#ff0000"), { target: { value: "Aurelia" } });
    fireEvent.change(nationInput("#00ff00"), { target: { value: "Aurelia" } });
    expect(screen.getByText(/Aurelia has more than one colour/i)).toBeInTheDocument();
    expect(vectorise()).toBeDisabled();
  });
});
