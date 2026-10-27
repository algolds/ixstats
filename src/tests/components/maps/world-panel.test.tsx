/**
 * Who gets the world tools, and the writes they guard: the World tab is offered to the realm's map editors only, the
 * MyCountry map editor to every owner; a generated nation slot's Claimable switch writes the slot, and Delete
 * slot deletes only after a confirmation and never a slot a player holds. The World tab reads a claims status it could
 * not load as a failed lock, not an open one, and a founder's saved recipe is never overwritten by the built-ins that
 * stand in for presets that could not be read, while a recipe naming a preset that is gone becomes Earth-like.
 *
 * Folds: src/tests/components/maps/world-panel-presets.test.tsx, src/tests/components/maps/world-slot-tools.test.tsx,
 * src/tests/components/maps/world-tab.test.ts, src/tests/components/mycountry/map-editor-action.test.tsx
 */
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

// No premium ability: the header's map editor must not depend on one.
const can = () => false;

jest.mock("~/trpc/react", () => {
  const { createMockMutation, createMockQuery } = jest.requireActual(
    "../../../../jest-mocks/trpc-react"
  );
  const fake = jest.requireActual("~/tests/helpers/fake-map-import");
  const invalidate = jest.fn();
  return {
    api: {
      useUtils: () => {
        const utils = fake.useUtils();
        return {
          realms: { map: { ...utils.realms.map, worldSlot: { invalidate } } },
          countries: { getAll: { invalidate } },
          geoCore: {
            listCountries: { invalidate },
            getMapBundleMarkers: { invalidate },
            getMapBundleDetail: { invalidate },
          },
        };
      },
      geoEditor: fake.geoEditor,
      intent: { getStatus: { useQuery: () => ({ data: undefined }) } },
      realms: {
        map: {
          display: { useQuery: jest.fn(() => createMockQuery()) },
          worldStatus: { useQuery: jest.fn(() => createMockQuery()) },
          worldPresets: { useQuery: jest.fn(() => createMockQuery()) },
          worldSlot: { useQuery: jest.fn(() => createMockQuery()) },
          setSlotClaimable: { useMutation: jest.fn(() => createMockMutation()) },
          deleteSlot: { useMutation: jest.fn(() => createMockMutation()) },
        },
      },
    },
  };
});
jest.mock("~/hooks/useWorldPreview", () => ({ useWorldPreview: jest.fn() }));
jest.mock("~/hooks/useMapLayerData", () => ({
  useDecodedMapLayers: jest.fn(),
  useRetryMapLayers: jest.fn(),
}));
// The real region, called through, so the panel's props to it can be read
jest.mock("~/components/maps/editor/panels/WorldApplyRegion", () => {
  const actual = jest.requireActual("~/components/maps/editor/panels/WorldApplyRegion");
  return { ...actual, WorldApplyRegion: jest.fn(actual.WorldApplyRegion) };
});
jest.mock("~/components/maps/editor/components/EditorConfirmDialog", () => ({
  confirmEditorAction: jest.fn(),
}));
// The MyCountry header's own surroundings
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    ...props
  }: { children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));
jest.mock("~/components/providers/AbilityProvider", () => ({
  useAbility: () => ({ can, cannot: () => true }),
}));
jest.mock("~/hooks/usePermissions", () => ({ useIsBetaTester: () => false }));
jest.mock("~/components/mycountry/shared/primitives", () => ({
  useCountryData: () => ({ country: { name: "Pelaxia" } }),
}));
jest.mock("~/components/achievements/FloatingRibbonRack", () => ({
  CountryOwnerRibbonRack: () => null,
}));
jest.mock("~/components/country-profile/CountryIdentityStrip", () => ({
  CountryIdentityStrip: () => null,
}));

import { api } from "~/trpc/react";
import type { TabId } from "~/components/maps/editor/EditorPanel";
import { confirmEditorAction } from "~/components/maps/editor/components/EditorConfirmDialog";
import { WorldSlotTools } from "~/components/maps/editor/components/WorldSlotTools";
import { sidebarTabsFor } from "~/components/maps/editor/utils/world-tab";
import { UnifiedGlassCommandBar } from "~/components/mycountry/shell/headers/UnifiedGlassCommandBar";
import { DEFAULT_PARAMS } from "~/lib/worldgen/v2/config";
import { controlsForPreset } from "~/lib/worldgen/world-controls";
import { loadWorldRecipe, saveWorldRecipe } from "~/lib/worldgen/world-draft-recipe";
import { FACTORY_PRESETS, type WorldPresetOption } from "~/lib/worldgen/world-presets";
import { stubResizeObserver } from "~/tests/helpers/resize-observer";
import {
  REALM,
  cleanUpPanelTests,
  displayQuery,
  lastRequest,
  presetsQuery,
  region,
  renderPanel,
  requestCount,
  resetPanelTests,
  settle,
  statusQuery,
} from "~/tests/helpers/world-panel-fixtures";

beforeAll(stubResizeObserver);

describe("who is offered the world tools", () => {
  it("offers the World tab to the realm's map editors where the layout put it, and to no viewer, on Ixnay or in the country editor", () => {
    const editor = { isWorldMode: true, canEdit: true, isIxnay: false };
    const tabs: TabId[] = ["linkages", "sovereignty", "layers", "world"];
    const rest = ["linkages", "sovereignty", "layers"];
    expect(sidebarTabsFor(tabs, editor)).toEqual(tabs);
    expect(sidebarTabsFor(tabs, { ...editor, isIxnay: true })).toEqual(rest);
    expect(sidebarTabsFor(tabs, { ...editor, canEdit: false })).toEqual(rest);
    expect(sidebarTabsFor(tabs, { ...editor, isWorldMode: false })).toEqual(rest);
  });

  describe("the MyCountry header's map editor", () => {
    beforeEach(() => {
      globalThis.IntersectionObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      } as unknown as typeof IntersectionObserver;
    });
    const renderBar = () =>
      render(<UnifiedGlassCommandBar mode="home" onChangeMode={() => undefined} />);

    it("opens the Edit pill into the country and map editors for an owner without premium", () => {
      renderBar();
      fireEvent.click(screen.getByRole("button", { name: "Edit country or map" }));
      expect(screen.getByRole("link", { name: "Map editor" })).toHaveAttribute(
        "href",
        "/mycountry/map-editor"
      );
      expect(screen.getByRole("link", { name: "Country editor" })).toHaveAttribute(
        "href",
        "/mycountry/editor#identity"
      );
    });
  });
});

describe("a generated nation slot's tools", () => {
  type SlotInfo = { worldgen: boolean; claimable: boolean; owned: boolean; claims: number };
  const queries = jest.mocked(api.realms.map.worldSlot.useQuery as unknown as jest.Mock);
  const claimable = jest.mocked(
    api.realms.map.setSlotClaimable.useMutation as unknown as jest.Mock
  );
  const deletion = jest.mocked(api.realms.map.deleteSlot.useMutation as unknown as jest.Mock);
  const confirm = jest.mocked(confirmEditorAction);
  const query = (data: SlotInfo) => ({ data, isLoading: false, error: null });
  const SLOT: SlotInfo = { worldgen: true, claimable: true, owned: false, claims: 0 };
  let setClaimable: jest.Mock;
  let remove: jest.Mock;

  beforeEach(() => {
    displayQuery.mockReturnValue({ data: { realmSlug: "eurth", isIxnay: false } });
    queries.mockReturnValue(query(SLOT));
    setClaimable = jest.fn();
    remove = jest.fn();
    claimable.mockReturnValue({ mutate: setClaimable, isPending: false });
    deletion.mockReturnValue({ mutate: remove, isPending: false });
    confirm.mockReset();
    confirm.mockResolvedValue(true);
  });
  const renderTools = (onDeleted = jest.fn()) => {
    render(<WorldSlotTools countryId="c_slot" countryName="Valdoria" onDeleted={onDeleted} />);
    return onDeleted;
  };

  it("writes Claimable when the switch is flipped, and deletes a free slot only once the deletion is confirmed", async () => {
    const onDeleted = renderTools();
    fireEvent.click(screen.getByRole("switch", { name: "Claimable" }));
    expect(setClaimable).toHaveBeenCalledWith({
      realm: "eurth",
      countryId: "c_slot",
      claimable: false,
    });

    // Declined first, then confirmed: one deletion
    confirm.mockResolvedValueOnce(false);
    fireEvent.click(screen.getByRole("button", { name: "Delete slot" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete slot" }));
    await waitFor(() => expect(remove).toHaveBeenCalled());
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(confirm).toHaveBeenLastCalledWith(expect.objectContaining({ destructive: true }));
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith({ realm: "eurth", countryId: "c_slot" });

    // The mutation's success handler is what deselects the deleted slot
    const options = deletion.mock.calls.at(-1)?.[0] as { onSuccess: () => void };
    act(() => options.onSuccess());
    expect(onDeleted).toHaveBeenCalled();
  });

  it("can't reserve or delete a slot a player holds", () => {
    queries.mockReturnValue(query({ ...SLOT, owned: true }));
    renderTools();
    const toggle = screen.getByRole("switch", { name: "Claimable" });
    expect(toggle).toBeDisabled();
    fireEvent.click(toggle);
    expect(setClaimable).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Delete slot" })).toBeNull();
  });
});

describe("the World tab", () => {
  beforeEach(resetPanelTests);
  afterEach(cleanUpPanelTests);

  it("hands the apply region a failed lock, not a loading or open one, when the claims status could not be read", () => {
    const refetch = jest.fn();
    statusQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { message: "Realm not found" },
      refetch,
    });
    renderPanel();
    expect(region.mock.lastCall![0].lock).toMatchObject({
      phase: "failed",
      message: "Realm not found",
    });
    fireEvent.click(screen.getByRole("button", { name: "Check claims again" }));
    expect(refetch).toHaveBeenCalled();
  });

  describe("a saved recipe and the presets", () => {
    const badlands: WorldPresetOption = {
      slug: "badlands",
      name: "Badlands",
      params: { continentCount: 4, temperatureOffset: 6, terrainRoughness: 0.9, hasIcecaps: false },
    };
    const published = [FACTORY_PRESETS[0]!, badlands];

    it("never writes the built-ins standing in for unreadable presets over a founder's saved recipe", () => {
      saveWorldRecipe(REALM, {
        seed: 91,
        controls: { ...controlsForPreset("badlands", published), rivers: 1.3 },
      });
      presetsQuery.mockReturnValue({ data: undefined, isError: true });
      renderPanel();
      // The preview is made, as Earth-like, but the stored choice stays the founder's
      expect(requestCount()).toBe(1);
      settle();
      expect(loadWorldRecipe(REALM)?.controls).toMatchObject({ preset: "badlands", rivers: 1.3 });
      fireEvent.click(screen.getByRole("radio", { name: "Eurth" }));
      expect(requestCount()).toBe(2);
      expect(loadWorldRecipe(REALM)?.controls).toMatchObject({ preset: "badlands" });
    });

    it("generates a saved recipe whose preset is gone as Earth-like, and saves it so", () => {
      presetsQuery.mockReturnValue({ data: published, isError: false });
      saveWorldRecipe(REALM, {
        seed: 91,
        controls: { ...controlsForPreset("ixnay"), rivers: 1.3 },
      });
      renderPanel();
      expect(lastRequest()).toMatchObject({ seed: 91 });
      expect(lastRequest().params).toMatchObject({
        hypsometry: DEFAULT_PARAMS.hypsometry,
        riverDensity: 1.3,
      });
      expect(screen.getByRole("radio", { name: "Earth-like" })).toBeChecked();
      expect(loadWorldRecipe(REALM)?.controls).toMatchObject({
        preset: "earthlike",
        hypsometry: "earthlike",
        rivers: 1.3,
      });
    });
  });
});
