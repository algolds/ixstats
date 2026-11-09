/** The back face's Factbook images: pinned or automatic per block, Change and Clear. */
import { fireEvent, render, screen, within } from "@testing-library/react";

const mutate = jest.fn();
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({
      cardImages: { getAllByCountry: { invalidate: jest.fn() } },
      countries: { getPublicRecord: { invalidate: jest.fn() } },
    }),
    cardImages: {
      getAllByCountry: {
        useQuery: () => ({ data: { government: { imageUrl: "https://x.example/palace.jpg" } } }),
      },
      delete: { useMutation: () => ({ mutate, isPending: false }) },
    },
  },
}));
jest.mock("~/components/mycountry/shared/primitives", () => ({
  CardImageUploadModal: ({ cardType }: { cardType: string }) => (
    <div role="dialog" aria-label={`Pick ${cardType}`} />
  ),
}));

import { FactbookImages } from "~/components/country-profile/FactbookImages";

const COVERS = {
  economy: { url: "/images/a/ab/Bank.jpg", caption: "Economy of Caphiria" },
  state: { url: "/images/a/ab/Seal.svg", caption: "Government of Caphiria" },
  foreign: null,
};

const row = (label: string) => screen.getByText(label).closest("li")!;

describe("FactbookImages", () => {
  beforeEach(() => mutate.mockReset());

  it("says which blocks are pinned, automatic, or on their map", () => {
    render(<FactbookImages countryId="c1" covers={COVERS} hasMap active />);
    expect(within(row("Economy & people")).getByText("Automatic")).toBeInTheDocument();
    expect(within(row("State")).getByText("Pinned")).toBeInTheDocument();
    expect(within(row("Foreign affairs")).getByText("Automatic: map")).toBeInTheDocument();
  });

  it("does not promise a map to a country without one", () => {
    render(<FactbookImages countryId="c1" covers={COVERS} hasMap={false} active />);
    expect(within(row("Foreign affairs")).getByText("Automatic: no image yet")).toBeInTheDocument();
  });

  it("clears only a pinned block, by its slot", () => {
    render(<FactbookImages countryId="c1" covers={COVERS} hasMap active />);
    expect(within(row("Economy & people")).queryByRole("button", { name: "Clear" })).toBeNull();
    fireEvent.click(within(row("State")).getByRole("button", { name: "Clear" }));
    expect(mutate).toHaveBeenCalledWith({ countryId: "c1", cardType: "government" });
  });

  it("opens the picker for the block's slot", () => {
    render(<FactbookImages countryId="c1" covers={COVERS} hasMap active />);
    fireEvent.click(within(row("Foreign affairs")).getByRole("button", { name: "Change" }));
    expect(screen.getByRole("dialog", { name: "Pick diplomacy" })).toBeInTheDocument();
  });
});
