import { renderHook, act } from "@testing-library/react";
import { useMapHistory } from "~/hooks/map-editor/useMapHistory";
import type { EditorAction } from "~/hooks/map-editor/useMapHistory";

describe("useMapHistory", () => {
  const sampleAction1: Omit<EditorAction, "timestamp"> = {
    type: "create",
    featureType: "city",
    featureId: "city-1",
    description: 'Created City "Aethelgard"',
    newData: { name: "Aethelgard", coordinates: [10, 20] },
  };

  const sampleAction2: Omit<EditorAction, "timestamp"> = {
    type: "update",
    featureType: "city",
    featureId: "city-1",
    description: 'Renamed City to "New Aethelgard"',
    previousData: { name: "Aethelgard" },
    newData: { name: "New Aethelgard" },
  };

  const sampleAction3: Omit<EditorAction, "timestamp"> = {
    type: "delete",
    featureType: "city",
    featureId: "city-1",
    description: 'Deleted City "New Aethelgard"',
    previousData: { name: "New Aethelgard" },
  };

  test("1. initializes with empty state and cannot undo or redo", () => {
    const { result } = renderHook(() => useMapHistory());

    expect(result.current.actions).toEqual([]);
    expect(result.current.position).toBe(-1);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  test("2. pushes actions and automatically attaches timestamps", () => {
    const { result } = renderHook(() => useMapHistory());

    act(() => {
      result.current.pushAction(sampleAction1);
    });

    expect(result.current.actions.length).toBe(1);
    expect(result.current.position).toBe(0);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.actions[0]?.description).toBe('Created City "Aethelgard"');
    expect(typeof result.current.actions[0]?.timestamp).toBe("number");
  });

  test("3. navigates undo and redo correctly", () => {
    const { result } = renderHook(() => useMapHistory());

    act(() => {
      result.current.pushAction(sampleAction1);
      result.current.pushAction(sampleAction2);
    });

    expect(result.current.actions.length).toBe(2);
    expect(result.current.position).toBe(1);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);

    // Undo to position 0
    act(() => {
      const action = result.current.undo();
      expect(action?.description).toBe('Renamed City to "New Aethelgard"');
    });

    expect(result.current.position).toBe(0);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(true);

    // Undo to position -1 (empty)
    act(() => {
      const action = result.current.undo();
      expect(action?.description).toBe('Created City "Aethelgard"');
    });

    expect(result.current.position).toBe(-1);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);

    // Redo to position 0
    act(() => {
      const action = result.current.redo();
      expect(action?.description).toBe('Created City "Aethelgard"');
    });

    expect(result.current.position).toBe(0);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(true);
  });

  test("4. truncates future branch when pushing new action after undo", () => {
    const { result } = renderHook(() => useMapHistory());

    act(() => {
      result.current.pushAction(sampleAction1);
      result.current.pushAction(sampleAction2);
      result.current.undo(); // back to position 0
    });

    expect(result.current.position).toBe(0);
    expect(result.current.actions.length).toBe(2);

    // Push new branch action
    act(() => {
      result.current.pushAction(sampleAction3);
    });

    expect(result.current.actions.length).toBe(2);
    expect(result.current.position).toBe(1);
    expect(result.current.actions[1]?.description).toBe('Deleted City "New Aethelgard"');
    expect(result.current.canRedo).toBe(false);
  });

  test("5. allows arbitrary position jumping via setPosition with clamping", () => {
    const { result } = renderHook(() => useMapHistory());

    act(() => {
      result.current.pushAction(sampleAction1);
      result.current.pushAction(sampleAction2);
      result.current.pushAction(sampleAction3);
    });

    expect(result.current.position).toBe(2);

    act(() => {
      result.current.setPosition(0);
    });
    expect(result.current.position).toBe(0);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(true);

    // Clamp out-of-bounds position
    act(() => {
      result.current.setPosition(-10);
    });
    expect(result.current.position).toBe(-1);

    act(() => {
      result.current.setPosition(100);
    });
    expect(result.current.position).toBe(2);
  });

  test("6. respects maxSize limit by dropping oldest entries", () => {
    const { result } = renderHook(() => useMapHistory(3));

    act(() => {
      result.current.pushAction({ ...sampleAction1, description: "Action 1" });
      result.current.pushAction({ ...sampleAction1, description: "Action 2" });
      result.current.pushAction({ ...sampleAction1, description: "Action 3" });
      result.current.pushAction({ ...sampleAction1, description: "Action 4" });
    });

    expect(result.current.actions.length).toBe(3);
    expect(result.current.position).toBe(2);
    expect(result.current.actions[0]?.description).toBe("Action 2");
    expect(result.current.actions[1]?.description).toBe("Action 3");
    expect(result.current.actions[2]?.description).toBe("Action 4");
  });

  test("7. clears history correctly", () => {
    const { result } = renderHook(() => useMapHistory());

    act(() => {
      result.current.pushAction(sampleAction1);
      result.current.pushAction(sampleAction2);
      result.current.clearHistory();
    });

    expect(result.current.actions).toEqual([]);
    expect(result.current.position).toBe(-1);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });
});
