import { fireEvent, render, screen, within } from "@testing-library/react";
import { RegionNationMapper } from "~/app/admin/maps/_components/map-import/RegionNationMapper";
import type { ImportRegion } from "~/lib/maps/import/options";

// The nation picker's suggestion list (cmdk) measures itself; jsdom has neither API.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= () => {};
});

const regions: ImportRegion[] = [
  { key: "#0000ff", colour: "#0000ff", pixels: 50, water: true },
  { key: "#ff0000", colour: "#ff0000", pixels: 30, name: "Aurelia" },
  { key: "#ee0000", colour: "#ee0000", pixels: 10 },
  { key: "#00ff00", colour: "#00ff00", pixels: 10 },
];
const nations = [{ name: "Aurelia", countryId: "c1" }, { name: "Borealis" }];

function renderMapper(onContinue = jest.fn()) {
  render(
    <RegionNationMapper
      regions={regions}
      suggested={{ "#ff0000": "Aurelia" }}
      nations={nations}
      busy={false}
      onContinue={onContinue}
    />
  );
  return onContinue;
}

const row = (hex: string) => screen.getByTestId(`region-${hex.slice(1)}`);
const nationInput = (hex: string) => within(row(hex)).getByPlaceholderText("Nation…");
const review = () => screen.getByRole("button", { name: /review the changes/i });

describe("RegionNationMapper", () => {
  it("lets two colours name one nation, merged into one border", () => {
    const onContinue = renderMapper();
    fireEvent.change(nationInput("#ee0000"), { target: { value: "Aurelia" } });
    expect(screen.getByText(/Merged from several regions: Aurelia/)).toBeInTheDocument();
    fireEvent.click(review());
    expect(onContinue).toHaveBeenCalledWith(
      expect.objectContaining({
        mapping: { "#ff0000": "Aurelia", "#ee0000": "Aurelia" },
        nations: 1,
        unmapped: 1,
      })
    );
  });

  it("flags a name that is not one of the realm's nations, with close spellings to pick", () => {
    renderMapper();
    fireEvent.change(nationInput("#00ff00"), { target: { value: "Borealys" } });
    const flagged = within(row("#00ff00")).getByText(/Not a nation of the realm yet/);
    fireEvent.click(within(flagged).getByRole("button", { name: "Borealis?" }));
    expect((nationInput("#00ff00") as HTMLInputElement).value).toBe("Borealis");
  });
});
