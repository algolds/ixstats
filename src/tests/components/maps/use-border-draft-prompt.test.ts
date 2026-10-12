import { renderHook } from "@testing-library/react";
import type { Polygon } from "geojson";

jest.mock("~/components/maps/editor/components/EditorConfirmDialog", () => ({
  confirmEditorAction: jest.fn(),
}));

import { confirmEditorAction } from "~/components/maps/editor/components/EditorConfirmDialog";
import { useBorderDraftPrompt } from "~/components/maps/editor/hooks/useBorderDraftPrompt";
import type { BorderDraft } from "~/lib/maps/border-draft";

const SQUARE: Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ],
  ],
};
const draft = (): BorderDraft => ({
  featureId: "Caphiria",
  geometry: SQUARE,
  dirtyNeighbors: {},
  savedAt: Date.UTC(2026, 9, 11, 9, 30),
});

type Props = Parameters<typeof useBorderDraftPrompt>[0];

function setup(initial: Props) {
  const actions = { restoreDraft: jest.fn(), discardDraft: jest.fn() };
  const hook = renderHook(({ state }: { state: Props }) => useBorderDraftPrompt(state, actions), {
    initialProps: { state: initial },
  });
  return { actions, ...hook };
}

/** Lets the confirm promise's continuation run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => jest.mocked(confirmEditorAction).mockReset());

describe("useBorderDraftPrompt", () => {
  it("asks nothing when the loaded border has no draft", () => {
    setup({ featureId: "Caphiria", pendingDraft: null });
    expect(confirmEditorAction).not.toHaveBeenCalled();
  });

  it("offers Restore unsaved changes or Discard for a draft", () => {
    jest.mocked(confirmEditorAction).mockReturnValue(new Promise(() => {}));
    setup({ featureId: "Caphiria", pendingDraft: draft() });

    expect(confirmEditorAction).toHaveBeenCalledTimes(1);
    expect(confirmEditorAction).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmLabel: "Restore unsaved changes",
        cancelLabel: "Discard",
        description: expect.stringContaining("Caphiria"),
      })
    );
  });

  it("restores the draft when the user accepts", async () => {
    jest.mocked(confirmEditorAction).mockResolvedValue(true);
    const offered = draft();
    const { actions } = setup({ featureId: "Caphiria", pendingDraft: offered });
    await settle();

    expect(actions.restoreDraft).toHaveBeenCalledWith(offered);
    expect(actions.discardDraft).not.toHaveBeenCalled();
  });

  it("discards the draft when the user declines or dismisses", async () => {
    jest.mocked(confirmEditorAction).mockResolvedValue(false);
    const offered = draft();
    const { actions } = setup({ featureId: "Caphiria", pendingDraft: offered });
    await settle();

    expect(actions.discardDraft).toHaveBeenCalledWith(offered);
    expect(actions.restoreDraft).not.toHaveBeenCalled();
  });

  it("asks once per draft however often the editor renders", () => {
    jest.mocked(confirmEditorAction).mockReturnValue(new Promise(() => {}));
    const offered = draft();
    const { rerender } = setup({ featureId: "Caphiria", pendingDraft: offered });

    rerender({ state: { featureId: "Caphiria", pendingDraft: offered } });
    rerender({ state: { featureId: "Caphiria", pendingDraft: offered } });

    expect(confirmEditorAction).toHaveBeenCalledTimes(1);
  });

  it("asks again for a different draft", () => {
    jest.mocked(confirmEditorAction).mockReturnValue(new Promise(() => {}));
    const { rerender } = setup({ featureId: "Caphiria", pendingDraft: draft() });

    rerender({ state: { featureId: "Daxia", pendingDraft: { ...draft(), featureId: "Daxia" } } });

    expect(confirmEditorAction).toHaveBeenCalledTimes(2);
  });
});
