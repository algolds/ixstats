import { useState } from "react";
import { act, renderHook } from "@testing-library/react";
import { deserialize, serialize } from "node:v8";
import { useEditChanges } from "~/app/builder/hooks/useEditChanges";
import { baseInitialState, type BuilderState } from "~/app/builder/hooks/builderStateTypes";
import { createDefaultEconomicInputs } from "~/app/builder/lib/default-economic-inputs";

const inputs = createDefaultEconomicInputs();
const originalRate = inputs.laborEmployment.unemploymentRate;
const loaded: BuilderState = { ...baseInitialState, step: "core", economicInputs: inputs };

function setRate(state: BuilderState, rate: number): BuilderState {
  const economicInputs = state.economicInputs ?? inputs;
  return {
    ...state,
    economicInputs: {
      ...economicInputs,
      laborEmployment: { ...economicInputs.laborEmployment, unemploymentRate: rate },
    },
  };
}

function renderEditor(enabled = true) {
  return renderHook(() => {
    const [state, setState] = useState(loaded);
    const edit = useEditChanges({
      enabled,
      isLoadingCountry: false,
      builderState: state,
      setBuilderState: setState,
    });
    return { state, setState, edit };
  });
}

type Editor = ReturnType<typeof renderEditor>;

function currentRate(editor: Editor): number | undefined {
  return editor.result.current.state.economicInputs?.laborEmployment.unemploymentRate;
}

function edit(editor: Editor, rate: number, thenWaitMs = 600) {
  act(() => editor.result.current.setState((prev) => setRate(prev, rate)));
  act(() => jest.advanceTimersByTime(thenWaitMs));
}

beforeAll(() => {
  // jsdom has no structuredClone; the browser does.
  globalThis.structuredClone = <T>(value: T): T => deserialize(serialize(value));
});

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("useEditChanges", () => {
  it("tracks changes against the loaded country once it settles", () => {
    const editor = renderEditor();
    expect(editor.result.current.edit.changes).toEqual([]);

    act(() => jest.advanceTimersByTime(600));
    edit(editor, 7.5);

    expect(editor.result.current.edit.changes).toEqual([
      { path: "economicInputs.laborEmployment.unemploymentRate", value: 7.5 },
    ]);
  });

  it("undoes one step at a time back to the loaded values", () => {
    const editor = renderEditor();
    act(() => jest.advanceTimersByTime(600));
    edit(editor, 7);
    edit(editor, 8);

    act(() => editor.result.current.edit.undo());
    expect(currentRate(editor)).toBe(7);

    act(() => jest.advanceTimersByTime(600));
    act(() => editor.result.current.edit.undo());
    expect(currentRate(editor)).toBe(originalRate);
    expect(editor.result.current.edit.changes).toEqual([]);
    expect(editor.result.current.edit.canUndo).toBe(false);
  });

  it("undoes a burst of rapid edits as one step", () => {
    const editor = renderEditor();
    act(() => jest.advanceTimersByTime(600));
    edit(editor, 7, 100);
    edit(editor, 8, 100);
    edit(editor, 9, 100);

    act(() => editor.result.current.edit.undo());
    expect(currentRate(editor)).toBe(originalRate);
  });

  it("discards to the loaded values, and the discard can be undone", () => {
    const editor = renderEditor();
    act(() => jest.advanceTimersByTime(600));
    edit(editor, 7);

    act(() => editor.result.current.edit.discard());
    expect(currentRate(editor)).toBe(originalRate);
    expect(editor.result.current.edit.changes).toEqual([]);
    expect(editor.result.current.edit.canUndo).toBe(true);

    act(() => jest.advanceTimersByTime(600));
    act(() => editor.result.current.edit.undo());
    expect(currentRate(editor)).toBe(7);
  });

  it("makes the saved state the new baseline", async () => {
    const editor = renderEditor();
    act(() => jest.advanceTimersByTime(600));
    edit(editor, 7);
    const persist = jest.fn(() => Promise.resolve());

    await act(() => editor.result.current.edit.save(persist));

    expect(persist).toHaveBeenCalledTimes(1);
    expect(editor.result.current.edit.changes).toEqual([]);
    expect(editor.result.current.edit.canUndo).toBe(false);
  });

  it("keeps the changes when saving fails", async () => {
    const editor = renderEditor();
    act(() => jest.advanceTimersByTime(600));
    edit(editor, 7);

    await act(async () => {
      await expect(
        editor.result.current.edit.save(() => Promise.reject(new Error("offline")))
      ).rejects.toThrow("offline");
    });

    expect(editor.result.current.edit.changes).toHaveLength(1);
  });

  it("tracks nothing outside edit mode", () => {
    const editor = renderEditor(false);
    act(() => jest.advanceTimersByTime(600));
    edit(editor, 7);

    expect(editor.result.current.edit.changes).toEqual([]);
    expect(editor.result.current.edit.canUndo).toBe(false);
  });
});
