/**
 * Transient Map Editor Store
 *
 * Decouples high-frequency mouse pointer movements, hover tooltips,
 * and transient drag coordinates from React state to eliminate top-level
 * re-render cascades across the map editor tree.
 *
 * Writes update the snapshot immediately but subscribers are notified at most
 * once per animation frame, so a 120 Hz pointer produces ≤ 1 React render per
 * frame in the leaf components that read it (status bar, hover tooltip, HUD).
 */

import { useSyncExternalStore } from "react";

export interface LiveTerrainInfo {
  elevation?: string | null;
  elevationMeters?: number | null;
  climate?: string | null;
  biomeColor?: string | null;
}

export interface TransientEditorState {
  hoveredFeatureId: string | null;
  cursorCoords: [number, number] | null;
  /** Cursor position in map-container pixels (for tooltips that follow the pointer). */
  cursorScreen: { x: number; y: number } | null;
  activeVertexIndex: number | null;
  terrainInfo: LiveTerrainInfo | null;
  /** Current map zoom (updated on zoom end). */
  zoom: number | null;
}

class TransientStore {
  private state: TransientEditorState = {
    hoveredFeatureId: null,
    cursorCoords: null,
    cursorScreen: null,
    activeVertexIndex: null,
    terrainInfo: null,
    zoom: null,
  };

  private listeners = new Set<() => void>();
  private frame: number | null = null;

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

  public setCursorCoords = (
    coords: [number, number] | null,
    screen?: { x: number; y: number } | null
  ): void => {
    const sameCoords =
      this.state.cursorCoords === coords ||
      (!!this.state.cursorCoords &&
        !!coords &&
        this.state.cursorCoords[0] === coords[0] &&
        this.state.cursorCoords[1] === coords[1]);
    const nextScreen = screen === undefined ? this.state.cursorScreen : screen;
    const sameScreen =
      this.state.cursorScreen === nextScreen ||
      (!!this.state.cursorScreen &&
        !!nextScreen &&
        this.state.cursorScreen.x === nextScreen.x &&
        this.state.cursorScreen.y === nextScreen.y);
    if (sameCoords && sameScreen) return;
    this.state = {
      ...this.state,
      cursorCoords: coords,
      cursorScreen: coords === null ? null : nextScreen,
    };
    this.emitChange();
  };

  public setTerrainInfo = (info: LiveTerrainInfo | null): void => {
    if (this.state.terrainInfo === info) return;
    this.state = { ...this.state, terrainInfo: info };
    this.emitChange();
  };

  public setActiveVertexIndex = (index: number | null): void => {
    if (this.state.activeVertexIndex === index) return;
    this.state = { ...this.state, activeVertexIndex: index };
    this.emitChange();
  };

  public setZoom = (zoom: number | null): void => {
    if (this.state.zoom === zoom) return;
    this.state = { ...this.state, zoom };
    this.emitChange();
  };

  private emitChange(): void {
    if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
      this.flush();
      return;
    }
    if (this.frame !== null) return;
    this.frame = window.requestAnimationFrame(() => {
      this.frame = null;
      this.flush();
    });
  }

  private flush(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const transientMapStore = new TransientStore();

/**
 * Hook to subscribe to transient map editor state changes cleanly.
 * The selector must return a primitive or a reference held by the store.
 */
export function useTransientMapStore<T>(selector: (state: TransientEditorState) => T): T {
  return useSyncExternalStore(
    transientMapStore.subscribe,
    () => selector(transientMapStore.getSnapshot()),
    () => selector(transientMapStore.getSnapshot())
  );
}
