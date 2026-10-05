/**
 * Happenings history: the sidebar panel links to "See all"; the full page lists every loaded page, filters by
 * kind (passed to the query) and loads older happenings on demand.
 */
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

const fetchNextPage = jest.fn();
const infiniteInputs: unknown[] = [];
let pages: Array<{ items: unknown[]; nextCursor: string | null }> = [];
let panelItems: unknown[] = [];

jest.mock("~/trpc/react", () => ({
  api: {
    realms: {
      region: {
        overview: { useQuery: () => ({ data: { realm: { name: "Eurth" } } }) },
        happenings: {
          useQuery: () => ({ data: { items: panelItems, nextCursor: null }, isLoading: false }),
          useInfiniteQuery: (input: unknown) => {
            infiniteInputs.push(input);
            return {
              data: { pages },
              isLoading: false,
              fetchNextPage,
              hasNextPage: pages.at(-1)?.nextCursor != null,
              isFetchingNextPage: false,
            };
          },
        },
      },
    },
  },
}));
jest.mock("~/hooks/usePageTitle", () => ({ usePageTitle: () => undefined }));

import { HappeningsPanel } from "~/app/r/[realm]/_components/RealmSidebar";
import RealmHappeningsPage from "~/app/r/[realm]/(region)/happenings/page";

const item = (id: string, text: string) => ({
  id,
  at: new Date(),
  kind: "nation",
  text,
  href: null,
});

beforeEach(() => {
  fetchNextPage.mockClear();
  infiniteInputs.length = 0;
});

describe("happenings", () => {
  it("the sidebar panel links to the full history", () => {
    panelItems = [item("n1", "Aurelia was founded")];
    render(<HappeningsPanel slug="eurth" />);
    expect(screen.getByText("Aurelia was founded")).toBeTruthy();
    expect(screen.getByRole("link", { name: "See all" }).getAttribute("href")).toContain(
      "/r/eurth/happenings"
    );
  });

  it("lists every loaded page, loads older ones and filters by kind", async () => {
    pages = [
      { items: [item("n2", "Borea was founded")], nextCursor: "2026-01-02T00:00:00.000Z" },
      { items: [item("n1", "Aurelia was founded")], nextCursor: "2026-01-01T00:00:00.000Z" },
    ];
    await act(async () => {
      render(<RealmHappeningsPage params={Promise.resolve({ realm: "eurth" })} />);
    });
    expect(screen.getByText("Borea was founded")).toBeTruthy();
    expect(screen.getByText("Aurelia was founded")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show older" }));
    expect(fetchNextPage).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Embassies" }));
    expect(infiniteInputs.at(-1)).toMatchObject({ slug: "eurth", kinds: ["embassy"] });
  });
});
