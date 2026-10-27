"use client";

/**
 * LazyDeckTransportOverlay — Dynamic code-split wrapper for DeckTransportOverlay.
 *
 * Ensures deck.gl and its WebGL shaders are strictly loaded on demand
 * without bloating the initial page load or blocking the main thread.
 */

import dynamic from "next/dynamic";
import type { DeckTransportOverlayProps } from "./DeckTransportOverlay";

export const LazyDeckTransportOverlay = dynamic<DeckTransportOverlayProps>(
  () => import("./DeckTransportOverlay").then((mod) => mod.DeckTransportOverlay),
  {
    ssr: false,
    loading: () => null,
  }
);
