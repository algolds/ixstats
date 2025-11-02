/**
 * Type declarations for @mapbox/mapbox-gl-draw
 *
 * This provides basic type support for the Mapbox GL Draw library.
 * For full type coverage, install @types/mapbox__mapbox-gl-draw if available.
 */

declare module "@mapbox/mapbox-gl-draw" {
  import type { IControl } from "maplibre-gl";

  export interface DrawCustomMode {
    onSetup?: (opts?: any) => any;
    onDrag?: (state: any, e: any) => void;
    onClick?: (state: any, e: any) => void;
    onMouseMove?: (state: any, e: any) => void;
    onMouseDown?: (state: any, e: any) => void;
    onMouseUp?: (state: any, e: any) => void;
    onTouchStart?: (state: any, e: any) => void;
    onTouchMove?: (state: any, e: any) => void;
    onTouchEnd?: (state: any, e: any) => void;
    onStop?: (state: any) => void;
    onTrash?: (state: any) => void;
    onCombineFeatures?: (state: any) => void;
    onUncombineFeatures?: (state: any) => void;
    toDisplayFeatures?: (state: any, geojson: any, display: (geojson: any) => void) => void;
  }

  export interface MapboxDrawOptions {
    displayControlsDefault?: boolean;
    keybindings?: boolean;
    touchEnabled?: boolean;
    boxSelect?: boolean;
    clickBuffer?: number;
    touchBuffer?: number;
    controls?: {
      point?: boolean;
      line_string?: boolean;
      polygon?: boolean;
      trash?: boolean;
      combine_features?: boolean;
      uncombine_features?: boolean;
    };
    modes?: Record<string, DrawCustomMode>;
    defaultMode?: string;
    styles?: any[];
    userProperties?: boolean;
  }

  export default class MapboxDraw implements IControl {
    constructor(options?: MapboxDrawOptions);

    onAdd(map: any): HTMLElement;
    onRemove(map: any): void;

    add(geojson: any): string[];
    get(featureId: string): any;
    getFeatureIdsAt(point: { x: number; y: number }): string[];
    getSelectedIds(): string[];
    getSelected(): any;
    getSelectedPoints(): any;
    getAll(): any;
    delete(ids: string | string[]): this;
    deleteAll(): this;
    set(featureCollection: any): string[];
    trash(): this;
    combineFeatures(): this;
    uncombineFeatures(): this;
    getMode(): string;
    changeMode(mode: string, options?: any): this;
    setFeatureProperty(featureId: string, property: string, value: any): this;
  }
}
