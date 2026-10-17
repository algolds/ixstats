import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: jest.fn(),
    cards: {
      admin: {
        overview: { realms: { useQuery: jest.fn() } },
        packs: {
          list: { useQuery: jest.fn() },
          save: { useMutation: jest.fn() },
          setActive: { useMutation: jest.fn() },
          preview: { useQuery: jest.fn() },
        },
      },
    },
  },
}));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));

import { api, type RouterOutputs } from "~/trpc/react";
import { PacksTab } from "~/app/admin/cards/packs";

type PackRow = RouterOutputs["cards"]["admin"]["packs"]["list"][number];
type Preview = RouterOutputs["cards"]["admin"]["packs"]["preview"];

const packs = api.cards.admin.packs;
const save = jest.fn();
const setActive = jest.fn();

const booster: PackRow = {
  id: "pack_1",
  name: "IIWiki booster",
  description: null,
  artwork: null,
  packType: "BASIC",
  priceCredits: 250,
  cardCount: 5,
  guaranteedRarity: "RARE",
  isActive: true,
  commonOdds: 65,
  uncommonOdds: 25,
  rareOdds: 7,
  ultraRareOdds: 2,
  epicOdds: 0.9,
  legendaryOdds: 0.1,
  season: null,
  cardType: null,
  themeFilter: { realmIds: ["iiwiki"] },
  pool: { realmIds: ["iiwiki"], categories: [], cardTypes: [] },
  limitedQuantity: null,
  purchaseLimit: null,
  expiresAt: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  _count: { UserPack: 12 },
};

const preview: Preview = {
  total: 43,
  byRarity: [
    { rarity: "COMMON", count: 40, odds: 65, fallsBack: false },
    { rarity: "UNCOMMON", count: 0, odds: 25, fallsBack: true },
    { rarity: "RARE", count: 3, odds: 7, fallsBack: false },
    { rarity: "ULTRA_RARE", count: 0, odds: 2, fallsBack: true },
    { rarity: "EPIC", count: 0, odds: 0.9, fallsBack: true },
    { rarity: "LEGENDARY", count: 0, odds: 0.1, fallsBack: true },
  ],
  samples: [{ id: "c1", title: "Elm", rarity: "RARE", realmName: "IIWiki" }],
};

const serve = (list: { data?: PackRow[]; isError?: boolean }, previewData?: Preview) => {
  jest.mocked(api.useUtils).mockReturnValue({
    cards: { admin: { packs: { list: { invalidate: jest.fn() } } } },
  } as never);
  jest.mocked(api.cards.admin.overview.realms.useQuery).mockReturnValue({
    data: [{ id: "iiwiki", name: "IIWiki", isSystem: true }],
  } as never);
  jest.mocked(packs.list.useQuery).mockReturnValue(list as never);
  jest.mocked(packs.save.useMutation).mockReturnValue({ mutate: save, isPending: false } as never);
  jest
    .mocked(packs.setActive.useMutation)
    .mockReturnValue({ mutate: setActive, isPending: false } as never);
  jest.mocked(packs.preview.useQuery).mockReturnValue({ data: previewData } as never);
};

const saveButton = () => screen.getByRole("button", { name: "Save pack" });
const openEditor = (name = "IIWiki booster") =>
  fireEvent.click(screen.getByRole("button", { name: `Edit ${name}` }));

beforeEach(() => jest.clearAllMocks());

describe("PacksTab", () => {
  it("lists each pack with its price, guarantee and how many were issued", () => {
    serve({ data: [booster] });
    render(<PacksTab />);
    expect(screen.getByText("250 IxC")).toBeInTheDocument();
    expect(screen.getByText("Rare")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("edits a pack, shows its odds total, clears its guarantee, and saves", () => {
    serve({ data: [booster] });
    render(<PacksTab />);
    openEditor();
    expect(screen.getByText("Odds add up to 100%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear guarantee" }));
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    fireEvent.click(saveButton());
    expect(save.mock.calls[0]?.[0]).not.toHaveProperty("season");
    expect(save.mock.calls[0]?.[0]).not.toHaveProperty("cardType");
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "pack_1",
        packType: "BASIC",
        guaranteedRarity: null,
        odds: {
          commonOdds: 65,
          uncommonOdds: 25,
          rareOdds: 7,
          ultraRareOdds: 2,
          epicOdds: 0.9,
          legendaryOdds: 0.1,
        },
        pool: { realmIds: ["iiwiki"], categories: ["HISTORY"], cardTypes: [] },
      })
    );
  });

  it("keeps the editor's title clear of the sheet's close button, and pins each row's Edit", () => {
    serve({ data: [booster] });
    render(<PacksTab />);
    expect(
      screen.getByRole("button", { name: "Edit IIWiki booster" }).closest("td")
    ).toHaveAttribute("data-pinned");
    openEditor();
    const title = screen.getByRole("heading", { name: "Edit IIWiki booster" });
    // The close button sits 16px in and is 28px wide; the sheet's 24px padding plus pr-8 clears it.
    expect(title.parentElement?.className).toContain("pr-8");
  });

  it("blocks Save and the preview while the odds do not add up to 100%", () => {
    serve({ data: [booster] });
    render(<PacksTab />);
    openEditor();
    fireEvent.change(screen.getByLabelText("Common (%)"), { target: { value: "64" } });
    expect(screen.getByText("Odds add up to 99%. They must add up to 100%.")).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Preview the pool" })).toBeDisabled();
  });

  it("blocks Save with a reason for a price that is not a whole number of IxC", () => {
    serve({ data: [booster] });
    render(<PacksTab />);
    openEditor();
    fireEvent.change(screen.getByLabelText("Price (IxC)"), { target: { value: "" } });
    expect(
      screen.getByText("Set a whole-number price from 1 to 1,000,000 IxC.")
    ).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  it("makes the admin choose a kind for a pack stored with one the editor does not know", () => {
    serve({ data: [{ ...booster, packType: "LIMITED" }] });
    render(<PacksTab />);
    openEditor();
    expect(screen.getByText("Choose the pack's kind.")).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  it("says when the pack itself narrows the pool to a type or season", () => {
    serve({ data: [{ ...booster, cardType: "NS", season: 2 }] });
    render(<PacksTab />);
    openEditor();
    expect(
      screen.getByText("This pack draws only NationStates cards from season 2.")
    ).toBeInTheDocument();
  });

  it("keeps pool values the editor does not list when other values are toggled", () => {
    serve({
      data: [
        {
          ...booster,
          pool: { realmIds: ["iiwiki", "gone_realm"], categories: [], cardTypes: ["SPECIAL"] },
        },
      ],
    });
    render(<PacksTab />);
    openEditor();
    expect(screen.getAllByText("Also keeps 1 stored value not listed here.")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "IIWiki" }));
    fireEvent.click(screen.getByRole("button", { name: "Lore" }));
    fireEvent.click(saveButton());
    expect(save.mock.calls[0]?.[0].pool).toEqual({
      realmIds: ["gone_realm"],
      categories: [],
      cardTypes: ["LORE", "SPECIAL"],
    });
  });

  it("previews the pool on request and flags rarities with odds but no cards", () => {
    serve({ data: [booster] }, preview);
    render(<PacksTab />);
    openEditor();
    const previewQuery = () => jest.mocked(packs.preview.useQuery).mock.lastCall;
    expect(previewQuery()?.[1]).toMatchObject({ enabled: false });
    expect(screen.queryByText("43 approved cards in the pool")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Preview the pool" }));
    expect(previewQuery()).toEqual([
      expect.objectContaining({ cardType: null, season: null, pool: booster.pool }),
      expect.objectContaining({ enabled: true }),
    ]);
    expect(screen.getByText("43 approved cards in the pool")).toBeInTheDocument();
    expect(screen.getByText("Uncommon: 0, none to draw")).toBeInTheDocument();
    expect(screen.getByText("Common: 40")).toBeInTheDocument();
    expect(
      screen.getByText(
        "A rarity with odds but no cards draws from the next rarity down that has cards, or up when none below do."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Some cards in the pool" })).toHaveTextContent("Elm");
    // The guaranteed Rare has cards, so nothing warns about it
    expect(screen.queryByText(/guaranteed card/)).not.toBeInTheDocument();
  });

  it("warns when the pool has no card of the guaranteed rarity", () => {
    serve({ data: [{ ...booster, guaranteedRarity: "EPIC" }] }, preview);
    render(<PacksTab />);
    openEditor();
    fireEvent.click(screen.getByRole("button", { name: "Preview the pool" }));
    expect(
      screen.getByText(
        "No Epic cards are in this pool, so the guaranteed card draws another rarity."
      )
    ).toBeInTheDocument();
  });

  it("starts a new pack with today's default odds and an empty pool", () => {
    serve({ data: [booster] });
    render(<PacksTab />);
    fireEvent.click(screen.getByRole("button", { name: "New pack" }));
    expect(screen.getByText("Give the pack a name.")).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Treaty pack" } });
    fireEvent.click(saveButton());
    const sent = save.mock.calls[0]?.[0];
    expect(sent).toMatchObject({
      name: "Treaty pack",
      packType: "BASIC",
      isActive: false,
      pool: { realmIds: [], categories: [], cardTypes: [] },
    });
    expect(sent.id).toBeUndefined();
    expect(sent).not.toHaveProperty("season");
    expect(sent).not.toHaveProperty("cardType");
  });

  it("puts a pack on or off sale from the list", () => {
    serve({ data: [booster] });
    render(<PacksTab />);
    fireEvent.click(screen.getByRole("switch", { name: "IIWiki booster on sale" }));
    expect(setActive).toHaveBeenCalledWith({ packId: "pack_1", isActive: false });
  });

  it("says so when there are no packs, or when they did not load", () => {
    serve({ data: [] });
    const { unmount } = render(<PacksTab />);
    expect(screen.getByText("No packs yet")).toBeInTheDocument();
    unmount();
    serve({ isError: true });
    render(<PacksTab />);
    expect(screen.getByRole("alert")).toHaveTextContent("The packs did not load");
  });
});
