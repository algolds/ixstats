"use client";

/**
 * useGeoWorker — React hook for the GeoJSON processing Web Worker.
 *
 * Creates a worker on mount, terminates on unmount.
 * Falls back to main-thread processing if Workers are unsupported.
 */

import { useRef, useCallback, useEffect } from "react";
import type { FeatureCollection } from "geojson";

let idCounter = 0;

interface PendingRequest {
  resolve: (data: FeatureCollection) => void;
  reject: (err: Error) => void;
}

export function useGeoWorker() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Map<number, PendingRequest>>(new Map());

  useEffect(() => {
    if (typeof Worker === "undefined") return;

    try {
      const worker = new Worker(
        new URL("../lib/maps/geo-worker.ts", import.meta.url),
        { type: "module" },
      );

      worker.onmessage = (e: MessageEvent) => {
        const { id, result } = e.data;
        const pending = pendingRef.current.get(id);
        if (pending) {
          pending.resolve(result);
          pendingRef.current.delete(id);
        }
      };

      worker.onerror = (err) => {
        console.error("[useGeoWorker] Worker error:", err);
        // Reject all pending requests
        for (const [id, pending] of pendingRef.current) {
          pending.reject(new Error("Worker error"));
          pendingRef.current.delete(id);
        }
      };

      workerRef.current = worker;
    } catch (err) {
      console.warn("[useGeoWorker] Failed to initialize worker, falling back to main thread:", err);
    }

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      pendingRef.current.clear();
    };
  }, []);

  const filterByArea = useCallback(
    (data: FeatureCollection, minArea: number): Promise<FeatureCollection> => {
      // Fast path — no filtering needed
      if (minArea <= 0) return Promise.resolve(data);

      const worker = workerRef.current;
      if (!worker) {
        // Fallback: main-thread filtering
        return Promise.resolve({
          ...data,
          features: data.features.filter((f) => {
            const area = (f.properties?._areaSqKm as number) ?? 0;
            return area >= minArea;
          }),
        });
      }

      const id = ++idCounter;
      return new Promise((resolve, reject) => {
        pendingRef.current.set(id, { resolve, reject });
        worker.postMessage({ type: "FILTER_BY_AREA", id, data, minArea });
      });
    },
    [],
  );

  return { filterByArea };
}
