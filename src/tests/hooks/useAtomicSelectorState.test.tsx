import { renderHook, act } from "@testing-library/react";
import { useAtomicSelectorState } from "~/hooks/useAtomicSelectorState";

describe("useAtomicSelectorState (Headless Hook - Plan 166)", () => {
  test("1. initializes with default empty state and uncontrolled mechanics", () => {
    const { result } = renderHook(() => useAtomicSelectorState<string>());

    expect(result.current.selectedComponents).toEqual([]);
    expect(result.current.selectedIds.size).toBe(0);
    expect(result.current.canSelectMore).toBe(true);
    expect(result.current.maxComponents).toBe(15);
    expect(result.current.isReadOnly).toBe(false);
    expect(result.current.activeCategory).toBeNull();
    expect(result.current.searchQuery).toBe("");
  });

  test("2. selects, deselects, and toggles items respecting max capacity", () => {
    const onSelectionChange = jest.fn();
    const { result } = renderHook(() =>
      useAtomicSelectorState<string>({
        maxComponents: 2,
        onSelectionChange,
      })
    );

    act(() => {
      result.current.handleToggle("item_1");
    });
    expect(result.current.selectedComponents).toEqual(["item_1"]);
    expect(onSelectionChange).toHaveBeenCalledWith(["item_1"]);

    act(() => {
      result.current.handleToggle("item_2");
    });
    expect(result.current.selectedComponents).toEqual(["item_1", "item_2"]);
    expect(result.current.canSelectMore).toBe(false);

    // Attempting to select 3rd item at capacity should no-op
    act(() => {
      result.current.handleToggle("item_3");
    });
    expect(result.current.selectedComponents).toEqual(["item_1", "item_2"]);

    // Toggling existing item deselects it
    act(() => {
      result.current.handleToggle("item_1");
    });
    expect(result.current.selectedComponents).toEqual(["item_2"]);
    expect(result.current.canSelectMore).toBe(true);
  });

  test("3. handles clear and explicit setSelection", () => {
    const { result } = renderHook(() =>
      useAtomicSelectorState<string>({
        initialSelection: ["a", "b"],
        maxComponents: 3,
      })
    );

    expect(result.current.selectedComponents).toEqual(["a", "b"]);

    act(() => {
      result.current.handleClear();
    });
    expect(result.current.selectedComponents).toEqual([]);

    act(() => {
      result.current.setSelection(["x", "y", "z", "overflow"]);
    });
    expect(result.current.selectedComponents).toEqual(["x", "y", "z"]);
  });

  test("4. read-only mode blocks all mutations", () => {
    const onSelectionChange = jest.fn();
    const { result } = renderHook(() =>
      useAtomicSelectorState<string>({
        initialSelection: ["locked"],
        isReadOnly: true,
        onSelectionChange,
      })
    );

    expect(result.current.canSelectMore).toBe(false);

    act(() => {
      result.current.handleToggle("new_item");
      result.current.handleDeselect("locked");
      result.current.handleClear();
    });

    expect(result.current.selectedComponents).toEqual(["locked"]);
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  test("5. controlled mode respects incoming props over internal state", () => {
    const onSelectionChange = jest.fn();
    let selected = ["ctrl_1"];

    const { result, rerender } = renderHook(() =>
      useAtomicSelectorState<string>({
        selectedComponents: selected,
        onSelectionChange,
      })
    );

    expect(result.current.selectedComponents).toEqual(["ctrl_1"]);

    act(() => {
      result.current.handleToggle("ctrl_2");
    });
    expect(onSelectionChange).toHaveBeenCalledWith(["ctrl_1", "ctrl_2"]);

    // Update prop
    selected = ["ctrl_1", "ctrl_2"];
    rerender();

    expect(result.current.selectedComponents).toEqual(["ctrl_1", "ctrl_2"]);
  });

  test("6. anti-clobber: fresh equivalent initial array does not reset state", () => {
    let initial = ["a", "b"];

    const { result, rerender } = renderHook(() =>
      useAtomicSelectorState<string>({
        initialSelection: initial,
      })
    );

    act(() => {
      result.current.handleToggle("c");
    });
    expect(result.current.selectedComponents).toEqual(["a", "b", "c"]);

    // Pass a new array reference with same content
    initial = ["a", "b"];
    rerender();

    // In-progress selection remains unchanged
    expect(result.current.selectedComponents).toEqual(["a", "b", "c"]);
  });

  test("7. search query, category filter, and dialog states update independently", () => {
    const { result } = renderHook(() =>
      useAtomicSelectorState<string>({ defaultCategory: "economics" })
    );

    expect(result.current.activeCategory).toBe("economics");

    act(() => {
      result.current.setSearchQuery("fiscal");
      result.current.setActiveCategory("governance");
      result.current.dialogs.setInteractionsOpen(true);
    });

    expect(result.current.searchQuery).toBe("fiscal");
    expect(result.current.activeCategory).toBe("governance");
    expect(result.current.dialogs.interactionsOpen).toBe(true);
  });
});
