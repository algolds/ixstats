/**
 * A refetch of the selected feature's details (window focus, invalidation) must not wipe
 * in-progress edits; switching to another feature, or refetching with no edits, must reload.
 */

import { renderHook, act } from "@testing-library/react";
import type { SelectedCountry } from "~/components/maps/core/IxWorldMap";

let details: { wikiPageTitle: string | null; properties: Record<string, unknown> } | undefined;

jest.mock("~/trpc/react", () => {
  const mutation = { useMutation: () => ({ mutate: jest.fn(), isPending: false }) };
  return {
    api: {
      useUtils: () => ({}),
      geoEditor: {
        getFeatureDetails: { useQuery: () => ({ data: details, refetch: jest.fn() }) },
        updateFeatureProperties: mutation,
        createCountryFromShape: mutation,
      },
      geoCore: { recalculateArea: mutation },
    },
  };
});
jest.mock("~/hooks/useNotify", () => ({ notifyFromStore: jest.fn() }));

import { useEditorFeatureProperties } from "~/components/maps/editor/hooks/state/useEditorFeatureProperties";

const country = (featureId: string) => ({ featureId, displayName: featureId }) as SelectedCountry;

function setup(initial: SelectedCountry) {
  return renderHook(
    ({ sel }: { sel: SelectedCountry }) =>
      useEditorFeatureProperties({
        mapSelectedCountry: sel,
        realm: undefined as never,
        refetchValidation: () => undefined,
      }),
    { initialProps: { sel: initial } }
  );
}

describe("useEditorFeatureProperties refetch handling", () => {
  it("keeps unsaved edits when the same feature's details are refetched", () => {
    details = { wikiPageTitle: "A", properties: {} };
    const { result, rerender } = setup(country("f1"));
    expect(result.current.wikiPageTitle).toBe("A");

    act(() => result.current.setWikiPageTitle("Edited"));
    details = { wikiPageTitle: "A", properties: {} }; // fresh object, same content
    rerender({ sel: country("f1") });
    expect(result.current.wikiPageTitle).toBe("Edited");
  });

  it("reloads when there are no unsaved edits", () => {
    details = { wikiPageTitle: "A", properties: {} };
    const { result, rerender } = setup(country("f1"));
    details = { wikiPageTitle: "B", properties: {} };
    rerender({ sel: country("f1") });
    expect(result.current.wikiPageTitle).toBe("B");
  });

  it("reloads when another feature is selected, discarding edits", () => {
    details = { wikiPageTitle: "A", properties: {} };
    const { result, rerender } = setup(country("f1"));
    act(() => result.current.setWikiPageTitle("Edited"));
    details = { wikiPageTitle: "Other", properties: {} };
    rerender({ sel: country("f2") });
    expect(result.current.wikiPageTitle).toBe("Other");
  });
});
