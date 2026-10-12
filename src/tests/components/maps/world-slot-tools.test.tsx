/**
 * The Properties inspector's slot tools for a generated nation: the Claimable switch writes Country.claimable, and
 * Delete slot is offered only for a slot no player holds and no claim names, after a confirmation. Nothing shows
 * for a country the world generator did not make, or on Ixnay.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("~/trpc/react", () => {
  const { createMockMutation, createMockQuery } = jest.requireActual(
    "../../../../jest-mocks/trpc-react"
  );
  const worldSlot = { useQuery: jest.fn(() => createMockQuery()) };
  const setSlotClaimable = { useMutation: jest.fn(() => createMockMutation()) };
  const deleteSlot = { useMutation: jest.fn(() => createMockMutation()) };
  const display = { useQuery: jest.fn(() => createMockQuery()) };
  const invalidate = jest.fn();
  return {
    api: {
      useUtils: () => ({
        realms: { map: { worldSlot: { invalidate }, version: { invalidate } } },
        countries: { getAll: { invalidate } },
        geoCore: {
          listCountries: { invalidate },
          getMapBundleMarkers: { invalidate },
          getMapBundleDetail: { invalidate },
          getMapStats: { invalidate },
        },
      }),
      realms: { map: { display, worldSlot, setSlotClaimable, deleteSlot } },
    },
  };
});
jest.mock("~/components/maps/editor/components/EditorConfirmDialog", () => ({
  confirmEditorAction: jest.fn(),
}));
jest.mock("~/components/maps/core/MapRealmContext", () => ({ useMapRealm: () => "eurth" }));

import { api } from "~/trpc/react";
import { confirmEditorAction } from "~/components/maps/editor/components/EditorConfirmDialog";
import { WorldSlotTools } from "~/components/maps/editor/components/WorldSlotTools";

type SlotInfo = { worldgen: boolean; claimable: boolean; owned: boolean; claims: number };
const queries = jest.mocked(api.realms.map.worldSlot.useQuery as unknown as jest.Mock);
const displays = jest.mocked(api.realms.map.display.useQuery as unknown as jest.Mock);
const claimable = jest.mocked(api.realms.map.setSlotClaimable.useMutation as unknown as jest.Mock);
const deletion = jest.mocked(api.realms.map.deleteSlot.useMutation as unknown as jest.Mock);
const confirm = jest.mocked(confirmEditorAction);

const query = (data: SlotInfo | undefined) => ({ data, isLoading: false, error: null });
const SLOT: SlotInfo = { worldgen: true, claimable: true, owned: false, claims: 0 };

let setClaimable: jest.Mock;
let remove: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  displays.mockReturnValue({ data: { realmSlug: "eurth", isIxnay: false } });
  queries.mockReturnValue(query(SLOT));
  setClaimable = jest.fn();
  remove = jest.fn();
  claimable.mockReturnValue({ mutate: setClaimable, isPending: false });
  deletion.mockReturnValue({ mutate: remove, isPending: false });
  confirm.mockResolvedValue(true);
});

const renderTools = (onDeleted = jest.fn()) => {
  render(<WorldSlotTools countryId="c_slot" countryName="Valdoria" onDeleted={onDeleted} />);
  return onDeleted;
};

describe("WorldSlotTools", () => {
  it("asks about the country in the realm being edited", () => {
    renderTools();
    expect(queries).toHaveBeenCalledWith(
      { realm: "eurth", countryId: "c_slot" },
      expect.objectContaining({ enabled: true })
    );
  });

  it("shows nothing for a country the generator did not make", () => {
    queries.mockReturnValue(query({ ...SLOT, worldgen: false }));
    const { container } = render(
      <WorldSlotTools countryId="c" countryName="Hand-drawn" onDeleted={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows nothing while the slot loads, or when the realm is Ixnay", () => {
    queries.mockReturnValue(query(undefined));
    const loading = render(<WorldSlotTools countryId="c" countryName="x" onDeleted={jest.fn()} />);
    expect(loading.container).toBeEmptyDOMElement();
    loading.unmount();

    displays.mockReturnValue({ data: { realmSlug: "ixnay", isIxnay: true } });
    queries.mockReturnValue(query(SLOT));
    const ixnay = render(<WorldSlotTools countryId="c" countryName="x" onDeleted={jest.fn()} />);
    expect(ixnay.container).toBeEmptyDOMElement();
    expect(queries).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ enabled: false })
    );
  });

  it("writes Country.claimable when the switch is flipped", () => {
    renderTools();
    const toggle = screen.getByRole("switch", { name: "Claimable" });
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);
    expect(setClaimable).toHaveBeenCalledWith({
      realm: "eurth",
      countryId: "c_slot",
      claimable: false,
    });
  });

  it("shows a reserved slot as not claimable and flips it back on", () => {
    queries.mockReturnValue(query({ ...SLOT, claimable: false }));
    renderTools();
    const toggle = screen.getByRole("switch", { name: "Claimable" });
    expect(toggle).not.toBeChecked();
    fireEvent.click(toggle);
    expect(setClaimable).toHaveBeenCalledWith({
      realm: "eurth",
      countryId: "c_slot",
      claimable: true,
    });
  });

  it("deletes an unowned slot with no claim after a confirmation, then lets the editor deselect it", async () => {
    const onDeleted = renderTools();
    fireEvent.click(screen.getByRole("button", { name: "Delete slot" }));
    await waitFor(() => expect(remove).toHaveBeenCalled());
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ destructive: true, title: expect.stringContaining("Valdoria") })
    );
    expect(remove).toHaveBeenCalledWith({ realm: "eurth", countryId: "c_slot" });

    // The mutation's success handler is what deselects the deleted slot
    const options = deletion.mock.calls.at(-1)?.[0] as { onSuccess: () => void };
    act(() => options.onSuccess());
    expect(onDeleted).toHaveBeenCalled();
  });

  it("deletes nothing when the confirmation is declined", async () => {
    confirm.mockResolvedValue(false);
    renderTools();
    fireEvent.click(screen.getByRole("button", { name: "Delete slot" }));
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(remove).not.toHaveBeenCalled();
  });

  it("offers no deletion for a slot a player holds, and says why", () => {
    queries.mockReturnValue(query({ ...SLOT, owned: true }));
    renderTools();
    expect(screen.queryByRole("button", { name: "Delete slot" })).toBeNull();
    expect(screen.getByText(/a player holds this nation/i)).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Claimable" })).toBeInTheDocument();
  });

  it("offers no deletion for a slot with a claim, and says why", () => {
    queries.mockReturnValue(query({ ...SLOT, claims: 2 }));
    renderTools();
    expect(screen.queryByRole("button", { name: "Delete slot" })).toBeNull();
    expect(screen.getByText(/has a claim/i)).toBeInTheDocument();
  });
});
