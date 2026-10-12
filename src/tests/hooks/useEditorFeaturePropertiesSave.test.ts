/**
 * Saving the Properties inspector: a refused rename (another nation of the realm has the name) shows the server's
 * message, and a save refreshes everything that reads the nation's name, since a generated slot's nation is renamed
 * with its region.
 */

import { renderHook } from "@testing-library/react";
import type { SelectedCountry } from "~/components/maps/core/IxWorldMap";

jest.mock("~/trpc/react", () => {
  const mutation = () => ({
    useMutation: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
  });
  const reads = () => ({ invalidate: jest.fn() });
  const utils = {
    countries: reads(),
    realms: { getBySlug: reads(), map: { version: reads() } },
    geoCore: {
      listCountries: reads(),
      getMapBundleMarkers: reads(),
      getMapBundleDetail: reads(),
    },
  };
  return {
    api: {
      useUtils: () => utils,
      geoEditor: {
        getFeatureDetails: { useQuery: () => ({ data: undefined, refetch: jest.fn() }) },
        updateFeatureProperties: mutation(),
        createCountryFromShape: mutation(),
      },
      geoCore: { recalculateArea: mutation() },
    },
  };
});
jest.mock("~/hooks/useNotify", () => ({ notifyFromStore: jest.fn() }));

import { api } from "~/trpc/react";
import { notifyFromStore } from "~/hooks/useNotify";
import { useEditorFeatureProperties } from "~/components/maps/editor/hooks/state/useEditorFeatureProperties";

type Reads = { invalidate: jest.Mock };
type Utils = { countries: Reads; realms: { getBySlug: Reads } };
type SaveOptions = { onSuccess: () => void; onError: (error: { message: string }) => void };

const utils = () => (api.useUtils as unknown as () => Utils)();
const saveOptions = () =>
  jest
    .mocked(api.geoEditor.updateFeatureProperties.useMutation as unknown as jest.Mock)
    .mock.calls.at(-1)?.[0] as SaveOptions;

const refetchValidation = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  renderHook(() =>
    useEditorFeatureProperties({
      mapSelectedCountry: { featureId: "slot_27", displayName: "Algir" } as SelectedCountry,
      realm: undefined as never,
      refetchValidation,
    })
  );
});

describe("saving a region's properties", () => {
  it("shows the refusal when another nation of the realm already has the name", () => {
    const message = "Another nation of this realm is already called Algir Renamed";
    saveOptions().onError({ message });
    expect(notifyFromStore).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        title: "Could not save feature properties",
        message,
      })
    );
  });

  it("refreshes the nation lists and pages, and the Links list, once saved", () => {
    saveOptions().onSuccess();
    expect(utils().countries.invalidate).toHaveBeenCalled();
    expect(utils().realms.getBySlug.invalidate).toHaveBeenCalled();
    expect(refetchValidation).toHaveBeenCalled();
    expect(notifyFromStore).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Feature properties saved", type: "success" })
    );
  });
});
