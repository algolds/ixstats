import { useEffect, useRef } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { isKeyboardInputTarget } from "./drag-utils";

/** Holding Space turns the pointer into a pan grip. The returned ref is true while it is held. */
export function useSpacebarPan(
  mapRef: { readonly current: MapLibreMap | null },
  isLoaded: boolean
) {
  const activeRef = useRef(false);

  useEffect(() => {
    const setCursor = (cursor: string) => {
      const canvas = mapRef.current?.getCanvas();
      if (canvas) canvas.style.cursor = cursor;
    };
    const isSpace = (e: KeyboardEvent) => e.code === "Space" || e.key === " ";

    const onKeyDown = (e: KeyboardEvent) => {
      if (!isSpace(e) || isKeyboardInputTarget(document.activeElement)) return;
      e.preventDefault();
      if (!activeRef.current) {
        activeRef.current = true;
        setCursor("grab");
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (isSpace(e) && activeRef.current) {
        activeRef.current = false;
        setCursor("");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [mapRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;
    const setGripCursor = (cursor: string) => () => {
      if (activeRef.current) map.getCanvas().style.cursor = cursor;
    };
    const onDragStart = setGripCursor("grabbing");
    const onDragEnd = setGripCursor("grab");
    map.on("dragstart", onDragStart);
    map.on("dragend", onDragEnd);
    return () => {
      map.off("dragstart", onDragStart);
      map.off("dragend", onDragEnd);
    };
  }, [mapRef, isLoaded]);

  return activeRef;
}
