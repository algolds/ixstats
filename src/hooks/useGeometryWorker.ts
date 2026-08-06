/**
 * useGeometryWorker - React hook for offloading heavy spatial calculations to a Web Worker.
 */

import { useRef, useEffect, useCallback } from "react";
import type { GeometryWorkerMessage } from "~/lib/worldgen/workers/geometry.worker";

export type { GeometryWorkerMessage };

interface PendingRequest {
  resolve: (res: any) => void;
  reject: (err: any) => void;
}

export function useGeometryWorker() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Map<string, PendingRequest>>(new Map());

  useEffect(() => {
    // Lazy worker instantiation when supported
    if (typeof window !== "undefined" && typeof window.Worker !== "undefined") {
      try {
        const worker = new Worker(
          new URL("../lib/worldgen/workers/geometry.worker.ts", typeof document !== "undefined" ? document.baseURI : "http://localhost"),
          { type: "module" }
        );

        worker.onmessage = (e: MessageEvent) => {
          const { id, success, result, error } = e.data;
          const pending = pendingRef.current.get(id);
          if (pending) {
            pendingRef.current.delete(id);
            if (success) {
              pending.resolve(result);
            } else {
              pending.reject(new Error(error));
            }
          }
        };

        workerRef.current = worker;
      } catch (err) {
        console.warn("[useGeometryWorker] Fallback to main thread worker disabled", err);
      }
    }

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const dispatchWorker = useCallback(
    <T>(type: GeometryWorkerMessage["type"], payload: any): Promise<T> => {
      return new Promise((resolve, reject) => {
        const id = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        pendingRef.current.set(id, { resolve, reject });

        if (workerRef.current) {
          workerRef.current.postMessage({ id, type, payload });
        } else {
          // Direct fallback resolution if Web Workers are unavailable in environment
          reject(new Error("Worker unavailable"));
        }
      });
    },
    []
  );

  return { dispatchWorker };
}
