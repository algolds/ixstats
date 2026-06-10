"use client";

import { useEffect, useCallback, useState } from "react";

let _sharedIframe: HTMLIFrameElement | null = null;
let _preloaded = false;
let _activeId: string | null = null;
const _subscribers = new Set<(id: string | null) => void>();

function notify(id: string | null) {
  _subscribers.forEach((fn) => fn(id));
}

function subscribe(fn: (id: string | null) => void) {
  _subscribers.add(fn);
  return () => {
    _subscribers.delete(fn);
  };
}

function getOrCreateSharedIframe(): HTMLIFrameElement {
  if (_sharedIframe?.isConnected) return _sharedIframe;

  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;border:none";
  iframe.setAttribute("loading", "eager");
  iframe.setAttribute("allow", "fullscreen");
  iframe.setAttribute("title", "IxWorld Map Embed");
  document.body.appendChild(iframe);
  _sharedIframe = iframe;
  return iframe;
}

function preloadMapEngine(): void {
  if (_preloaded || typeof document === "undefined") return;
  const iframe = getOrCreateSharedIframe();
  iframe.src = "/maps?embed=true";
  _preloaded = true;
}

function swapIframeInto(container: HTMLElement, lat: number, lng: number, zoom: number): void {
  const iframe = getOrCreateSharedIframe();
  const src = `/maps?embed=true&lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}&zoom=${zoom}`;

  if (iframe.parentElement && iframe.parentElement !== container) {
    iframe.parentElement.removeChild(iframe);
  }

  Object.assign(iframe.style, {
    position: "absolute",
    inset: "0",
    width: "100%",
    height: "100%",
    opacity: "1",
    pointerEvents: "auto",
    display: "block",
    border: "none",
  });

  if (iframe.src !== src || !container.contains(iframe)) {
    iframe.src = src;
    container.appendChild(iframe);
  }
}

function hideSharedIframe(): void {
  if (!_sharedIframe) return;
  Object.assign(_sharedIframe.style, {
    position: "absolute",
    width: "1px",
    height: "1px",
    opacity: "0",
    pointerEvents: "none",
  });
  if (_sharedIframe.parentElement) {
    _sharedIframe.parentElement.removeChild(_sharedIframe);
  }
  document.body.appendChild(_sharedIframe);
}

export interface MapEmbedManager {
  activeId: string | null;
  activate: (id: string, lat: number, lng: number, zoom: number, container: HTMLElement) => void;
  deactivate: () => void;
}

export function useMapEmbedManager(): MapEmbedManager {
  const [activeId, setActiveId] = useState<string | null>(_activeId);

  useEffect(() => {
    return subscribe(setActiveId);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", preloadMapEngine, { once: true });
      return () => document.removeEventListener("DOMContentLoaded", preloadMapEngine);
    }
    preloadMapEngine();
  }, []);

  const activate = useCallback(
    (id: string, lat: number, lng: number, zoom: number, container: HTMLElement) => {
      if (_activeId === id) return;
      _activeId = id;
      swapIframeInto(container, lat, lng, zoom);
      notify(id);
    },
    []
  );

  const deactivate = useCallback(() => {
    _activeId = null;
    hideSharedIframe();
    notify(null);
  }, []);

  return { activeId, activate, deactivate };
}
