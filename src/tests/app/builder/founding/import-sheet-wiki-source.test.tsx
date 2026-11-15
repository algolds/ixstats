/**
 * The builder's "Import from the wiki": Wiki is the first and default wiki, the picked wiki reaches
 * `countries.searchWiki` and `countries.parseInfobox`, a switched-off IIWiki cannot be picked and says why, and a
 * wiki that cannot answer shows its own words instead of a generic failure.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { IiwikiAvailability } from "~/lib/wiki-os/wiki-source-availability";

const mockSearch = jest.fn();
const mockParse = jest.fn();
let mockAvailability: Partial<IiwikiAvailability> | undefined;

jest.mock("~/trpc/react", () => ({
  api: {
    countries: {
      searchWiki: { useMutation: () => ({ mutateAsync: mockSearch }) },
      parseInfobox: { useMutation: () => ({ mutateAsync: mockParse }) },
    },
    wikios: {
      iiwikiAvailability: { useQuery: () => ({ data: mockAvailability }) },
    },
  },
}));

import { ImportSheet } from "~/app/builder/_founding/components/ImportSheet";

const outage = Object.assign(new Error("IIWiki is switched off for now."), {
  data: { code: "SERVICE_UNAVAILABLE" },
});

function renderSheet() {
  return render(<ImportSheet open onOpenChange={() => undefined} onApply={() => undefined} />);
}

async function search(term: string) {
  fireEvent.change(screen.getByLabelText("Nation page"), { target: { value: term } });
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  mockSearch.mockReset();
  mockParse.mockReset();
  mockAvailability = { country: null };
});

afterEach(() => {
  jest.useRealTimers();
});

describe("ImportSheet wiki source", () => {
  it("lists Wiki first and searches it by default", async () => {
    mockSearch.mockResolvedValue([]);
    renderSheet();
    const names = screen.getAllByRole("radio").map((r) => r.textContent);
    expect(names[0]).toBe("Wiki");
    expect(names).toEqual(expect.arrayContaining(["IIWiki", "AltHistory Wiki"]));

    await search("Urcea");

    expect(mockSearch).toHaveBeenCalledWith({
      query: "Urcea",
      site: "ixwiki",
      categoryFilter: "Countries",
    });
  });

  it("searches and reads the picked sister wiki", async () => {
    mockSearch.mockResolvedValue([{ title: "Kirav" }]);
    mockParse.mockResolvedValue({ name: "Kirav" });
    renderSheet();
    fireEvent.click(screen.getByRole("radio", { name: "IIWiki" }));

    await search("Kirav");
    expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({ site: "iiwiki" }));

    fireEvent.click(await screen.findByText("Kirav"));
    await waitFor(() =>
      expect(mockParse).toHaveBeenCalledWith({ pageName: "Kirav", site: "iiwiki" })
    );
  });

  it("cannot pick IIWiki while it is switched off, and says so", () => {
    mockAvailability = { country: "disabled" };
    renderSheet();

    expect(screen.getByRole("radio", { name: "IIWiki" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "Wiki" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("IIWiki is switched off for now.")).toBeInTheDocument();
  });

  it("shows a wiki's outage in its own words", async () => {
    mockSearch.mockRejectedValue(outage);
    renderSheet();
    fireEvent.click(screen.getByRole("radio", { name: "IIWiki" }));

    await search("Kirav");

    expect(await screen.findByText("IIWiki is switched off for now.")).toBeInTheDocument();
  });
});
