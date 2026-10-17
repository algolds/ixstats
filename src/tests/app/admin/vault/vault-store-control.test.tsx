/** The store editor has no lore token perk (cards refresh spec §2.2), and saving an item drops one it still carries. */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/trpc/react", () => {
  const mutation = () => ({
    useMutation: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
  });
  return {
    api: {
      useUtils: jest.fn(() => ({
        vault: {
          adminListStoreItemsAll: { invalidate: jest.fn() },
          listStoreItems: { invalidate: jest.fn() },
        },
      })),
      vault: {
        adminListStoreItemsAll: { useQuery: jest.fn() },
        adminGetPriceHistory: { useQuery: jest.fn(() => ({ data: [], isLoading: false })) },
        adminCreateStoreItem: mutation(),
        adminUpdateStoreItem: mutation(),
        adminDeleteStoreItem: mutation(),
      },
    },
  };
});
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));
jest.mock("~/components/vault/sections/marketplace/VaultStoreTab", () => ({ ICON_MAP: {} }));

import { api } from "~/trpc/react";
import { VaultStoreControl } from "~/app/admin/vault/VaultStoreControl";

const upgrade = {
  id: "upgrade_myclub_license",
  name: "MyClub Team License Token",
  description: "",
  price: 5000,
  icon: "Trophy",
  glowColor: null,
  quality: "LEGENDARY",
  badgeText: "MyClub",
  category: "upgrades",
  isActive: true,
  effects: { perks: { cardCapacity: 50, loreTokens: 1 } as Record<string, number> },
};

function renderWith(item: typeof upgrade) {
  jest.mocked(api.vault.adminListStoreItemsAll.useQuery).mockReturnValue({
    data: [item],
    isLoading: false,
    refetch: jest.fn(),
  } as never);
  const update = jest.fn();
  jest
    .mocked(api.vault.adminUpdateStoreItem.useMutation)
    .mockReturnValue({ mutate: update, isPending: false } as never);
  render(<VaultStoreControl />);
  fireEvent.click(screen.getByTitle("Edit item"));
  return update;
}

describe("VaultStoreControl upgrade perks", () => {
  it("offers no lore token field, and saving drops the perk", () => {
    const update = renderWith(upgrade);

    expect(screen.getByLabelText("Card Capacity (+)")).toHaveValue(50);
    expect(screen.queryByLabelText(/lore tokens/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Save Item" }));
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ id: upgrade.id, effects: { perks: { cardCapacity: 50 } } })
    );
  });

  it("saves an item whose only perk was lore tokens, leaving its effects untouched", () => {
    const update = renderWith({ ...upgrade, effects: { perks: { loreTokens: 1 } } });

    fireEvent.click(screen.getByRole("button", { name: "Save Item" }));
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0]).toMatchObject({ id: upgrade.id, price: 5000 });
    expect(update.mock.calls[0][0].effects).toBeUndefined();
  });
});
