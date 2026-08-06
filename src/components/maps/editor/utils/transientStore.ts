/**
 * Transient Map Editor Store (Phase 1: React State Isolation)
 *
 * Decouples high-frequency mouse pointer movements, hover tooltips,
 * and transient drag coordinates from React state to eliminate top-level
 * re-render cascades across the map editor tree.
 */

import { useSyncExternalStore } from "react";

export interface TransientEditorState {
  hoveredFeatureId: string | null;
  cursorCoords: [number, number] | null;
  activeVertexIndex: number | null;
}

class TransientStore {
  private state: TransientEditorState = {
    hoveredFeatureId: null,
    cursorCoords: null,
    activeVertexIndex: null,
  };

  private listeners = new Set<() => void>();

  public getSnapshot = (): TransientEditorState => {
    return this.state;
  };

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public setHoveredFeatureId = (id: string | null): void => {
    if (this.state.hoveredFeatureId === id) return;
    this.state = { ...this.state, hoveredFeatureId: id };
    this.emitChange();
  };

  public setCursorCoords = (coords: [number, number] | null): void => {
    if (
      this.state.cursorCoords &&
      coords &&
      this.state.cursorCoords[0] === coords[0] &&
      this.state.cursorCoords[1] === coords[1]
    ) {
      return;
    }
    this.state = { ...this.state, cursorCoords: coords };
    this.emitChange();
  };

  public setActiveVertexIndex = (index: number | null): void => {
    if (this.state.activeVertexIndex === index) return;
    this.state = { ...this.state, activeVertexIndex: index };
    this.emitChange();
  };

  private emitChange(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const transientMapStore = new TransientStore();

/**
 * Hook to subscribe to transient map editor state changes cleanly.
 */
export function useTransientMapStore<T>(selector: (state: TransientEditorState) => T): T {
  return useSyncExternalStore(
    transientMapStore.subscribe,
    () => selector(transientMapStore.getSnapshot()),
    () => selector(transientMapStore.getSnapshot())
  );
}
