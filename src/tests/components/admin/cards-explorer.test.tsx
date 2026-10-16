/** Cards refresh Task 22: the admin explorer reads cards.adminCardExplorer and shows the five card types. */
import { render, screen } from "@testing-library/react";
import { api } from "~/trpc/react";
import { AdminCardExplorer } from "~/app/admin/cards/AdminCardExplorer";
import { CARD_TYPE_FILTER_OPTIONS } from "~/app/admin/cards/explorer/CardExplorerFilters";

jest.mock("~/trpc/react", () => {
  const nsCard: import("@prisma/client").Card = {
    id: "card-ns-1",
    title: "Testlandia",
    slug: null,
    description: null,
    category: null,
    subcategory: null,
    artwork: null,
    artworkSource: "FLAG",
    artworkCredit: null,
    rarity: "RARE",
    season: 3,
    cardType: "NS",
    marketValue: 120,
    totalSupply: null,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    updatedAt: new Date("2026-10-01T00:00:00Z"),
    nsCardId: 42,
    nsSeason: 3,
    wikiSource: null,
    wikiArticleTitle: null,
    wikiExcerpt: null,
    countryId: null,
    metadata: { nsData: { region: "Abydos" } },
    isRetired: false,
    retiredAt: null,
    lorewardEntryId: null,
    lorewardEdition: null,
    realmId: "nationstates",
    isBound: false,
  };
  const mutation = () => ({ useMutation: () => ({ mutate: jest.fn(), isPending: false }) });
  return {
    api: {
      cards: {
        adminCardExplorer: {
          useQuery: jest.fn(() => ({
            data: { cards: [nsCard], total: 1, hasMore: false },
            isLoading: false,
            refetch: jest.fn(),
          })),
        },
        bulkToggleVisibility: mutation(),
        updateCardDetails: mutation(),
      },
    },
  };
});
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));
jest.mock("~/components/cards/display/CardDetailsModal", () => ({ CardDetailsModal: () => null }));
jest.mock("~/components/cards/display/CardDisplay", () => ({ CardDisplay: () => null }));

describe("admin card explorer", () => {
  it("offers all card types and each of the five types in the type pickers", () => {
    expect(CARD_TYPE_FILTER_OPTIONS).toEqual([
      ["all", "All card types"],
      ["LORE", "Lore"],
      ["NATION", "Nation"],
      ["NS", "NationStates"],
      ["SPECIAL", "Special"],
      ["TROPHY", "Trophy"],
    ]);
  });

  it("reads the admin explorer, retired cards included, and labels a row by its type", () => {
    render(<AdminCardExplorer />);

    expect(jest.mocked(api.cards.adminCardExplorer.useQuery)).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 25,
        offset: 0,
        cardTypeFilter: "all",
        cteFilter: "all",
        includeRetired: true,
        sortBy: "recent",
      })
    );
    expect(screen.getAllByText("NationStates").length).toBeGreaterThan(0);
  });
});
