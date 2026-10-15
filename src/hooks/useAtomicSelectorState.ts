"use client";

/**
 * Headless Atomic Selector State Hook (Plan 166)
 *
 * Encapsulates purely mechanical selector state:
 * - Controlled / value-synchronized selection state
 * - Selection bounds and read-only protections
 * - Search query and category filtering state
 * - Common dialog open/close states
 *
 * Strictly domain-agnostic: imports NO economic, government, or tax data or formulas.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from "react";

interface UseAtomicSelectorStateProps<T extends string> {
  /** Uncontrolled initial selection (synced by value) */
  initialSelection?: T[];
  /** Controlled selection (takes precedence over internal state if provided) */
  selectedComponents?: T[];
  /** Callback fired when selection changes */
  onSelectionChange?: (components: T[]) => void;
  /** Maximum number of selectable components */
  maxComponents?: number;
  /** Read-only mode prevents selection changes */
  isReadOnly?: boolean;
  /** Default category */
  defaultCategory?: string | null;
  /**
   * Which ids count toward `maxComponents` (default: all). Ids that do not count, such as
   * unknown types from old saved data, never block a selection. Pass a stable function.
   */
  countsTowardLimit?: (id: T) => boolean;
}

const countsAll = () => true;

/**
 * Trim a selection to the cap: ids that count are kept in order until the cap is reached;
 * ids that do not count are always kept. Duplicates are dropped.
 */
export function capSelection<T extends string>(
  ids: readonly T[],
  maxComponents: number,
  countsTowardLimit: (id: T) => boolean = countsAll
): T[] {
  const result: T[] = [];
  const seen = new Set<string>();
  let counted = 0;
  for (const id of ids) {
    if (seen.has(id)) continue;
    const counts = countsTowardLimit(id);
    if (counts && counted >= maxComponents) continue;
    seen.add(id);
    result.push(id);
    if (counts) counted++;
  }
  return result;
}

interface UseAtomicSelectorStateReturn<T extends string> {
  // Selection state
  selectedComponents: T[];
  selectedIds: Set<string>;
  isSelected: (id: T | string) => boolean;
  canSelectMore: boolean;
  maxComponents: number;
  isReadOnly: boolean;

  // Selection actions
  handleSelect: (id: T) => void;
  handleDeselect: (id: T) => void;
  handleToggle: (id: T) => void;
  handleClear: () => void;
  setSelection: (ids: T[]) => void;

  // Search & Filter state
  activeCategory: string | null;
  setActiveCategory: (category: string | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Dialog modal states
  dialogs: {
    interactionsOpen: boolean;
    setInteractionsOpen: (open: boolean) => void;
    selectedListOpen: boolean;
    setSelectedListOpen: (open: boolean) => void;
    effectivenessOpen: boolean;
    setEffectivenessOpen: (open: boolean) => void;
    implementationOpen: boolean;
    setImplementationOpen: (open: boolean) => void;
    maintenanceOpen: boolean;
    setMaintenanceOpen: (open: boolean) => void;
  };
}

export function useAtomicSelectorState<T extends string>({
  initialSelection = [],
  selectedComponents: controlledSelected,
  onSelectionChange,
  maxComponents = 15,
  isReadOnly = false,
  defaultCategory = null,
  countsTowardLimit = countsAll,
}: UseAtomicSelectorStateProps<T> = {}): UseAtomicSelectorStateReturn<T> {
  const isControlled = controlledSelected !== undefined;

  const [internalSelected, setInternalSelected] = useState<T[]>(initialSelection);
  const [activeCategory, setActiveCategory] = useState<string | null>(defaultCategory);
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog states
  const [interactionsOpen, setInteractionsOpen] = useState(false);
  const [selectedListOpen, setSelectedListOpen] = useState(false);
  const [effectivenessOpen, setEffectivenessOpen] = useState(false);
  const [implementationOpen, setImplementationOpen] = useState(false);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);

  const prevInitialRef = useRef<T[]>(initialSelection);

  // Synchronize internal state by value (anti-clobber protection)
  useEffect(() => {
    if (!isControlled) {
      const prevInit = prevInitialRef.current;
      const isSameInit =
        prevInit.length === initialSelection.length &&
        prevInit.every((item, i) => item === initialSelection[i]);

      if (!isSameInit) {
        prevInitialRef.current = initialSelection;
        setInternalSelected(initialSelection);
      }
    }
  }, [initialSelection, isControlled]);

  // Synchronize defaultCategory when it changes
  useEffect(() => {
    if (defaultCategory !== undefined) {
      setActiveCategory(defaultCategory);
    }
  }, [defaultCategory]);

  const activeSelection = isControlled ? (controlledSelected as T[]) : internalSelected;

  const selectedIds = useMemo(() => new Set<string>(activeSelection), [activeSelection]);

  const isSelected = useCallback((id: T | string) => selectedIds.has(id as string), [selectedIds]);

  const countedLength = useMemo(
    () => activeSelection.filter(countsTowardLimit).length,
    [activeSelection, countsTowardLimit]
  );

  const canSelectMore = useMemo(
    () => !isReadOnly && countedLength < maxComponents,
    [isReadOnly, countedLength, maxComponents]
  );

  const hasRoomFor = useCallback(
    (id: T) => !countsTowardLimit(id) || countedLength < maxComponents,
    [countsTowardLimit, countedLength, maxComponents]
  );

  const updateSelection = useCallback(
    (nextSelection: T[]) => {
      if (isReadOnly) return;
      if (!isControlled) {
        setInternalSelected(nextSelection);
      }
      onSelectionChange?.(nextSelection);
    },
    [isReadOnly, isControlled, onSelectionChange]
  );

  const handleSelect = useCallback(
    (id: T) => {
      if (isReadOnly) return;
      if (!selectedIds.has(id) && hasRoomFor(id)) {
        updateSelection([...activeSelection, id]);
      }
    },
    [isReadOnly, selectedIds, activeSelection, hasRoomFor, updateSelection]
  );

  const handleDeselect = useCallback(
    (id: T) => {
      if (isReadOnly) return;
      if (selectedIds.has(id)) {
        updateSelection(activeSelection.filter((item) => item !== id));
      }
    },
    [isReadOnly, selectedIds, activeSelection, updateSelection]
  );

  const handleToggle = useCallback(
    (id: T) => {
      if (isReadOnly) return;
      if (selectedIds.has(id)) {
        updateSelection(activeSelection.filter((item) => item !== id));
      } else if (hasRoomFor(id)) {
        updateSelection([...activeSelection, id]);
      }
    },
    [isReadOnly, selectedIds, activeSelection, hasRoomFor, updateSelection]
  );

  const handleClear = useCallback(() => {
    if (isReadOnly) return;
    updateSelection([]);
  }, [isReadOnly, updateSelection]);

  const setSelection = useCallback(
    (ids: T[]) => {
      if (isReadOnly) return;
      updateSelection(capSelection(ids, maxComponents, countsTowardLimit));
    },
    [isReadOnly, maxComponents, countsTowardLimit, updateSelection]
  );

  return {
    selectedComponents: activeSelection,
    selectedIds,
    isSelected,
    canSelectMore,
    maxComponents,
    isReadOnly,

    handleSelect,
    handleDeselect,
    handleToggle,
    handleClear,
    setSelection,

    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,

    dialogs: {
      interactionsOpen,
      setInteractionsOpen,
      selectedListOpen,
      setSelectedListOpen,
      effectivenessOpen,
      setEffectivenessOpen,
      implementationOpen,
      setImplementationOpen,
      maintenanceOpen,
      setMaintenanceOpen,
    },
  };
}
