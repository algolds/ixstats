"use client";

import { useEffect, useRef } from "react";

/**
 * Radix portals (dialogs, sheets, popovers, menus, tooltips) render into <body>, outside the app's
 * `[data-app]` subtree, so they would fall back to the default tint. Rendered inside an app scope, this
 * mirrors the deepest mounted scope onto <body> so portalled content inherits the app tint.
 */
const mounted = new Map<symbol, { app: string; depth: number }>();

function syncBody() {
  let deepest: { app: string; depth: number } | undefined;
  for (const scope of mounted.values()) {
    if (!deepest || scope.depth > deepest.depth) deepest = scope;
  }
  if (deepest) document.body.dataset.app = deepest.app;
  else delete document.body.dataset.app;
}

export function PortalTintSync() {
  const probe = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const scope = probe.current?.closest<HTMLElement>("[data-app]");
    const app = scope?.dataset.app;
    if (!scope || !app) return;
    let depth = 0;
    for (let el: HTMLElement | null = scope; el; el = el.parentElement) depth++;
    const key = Symbol(app);
    mounted.set(key, { app, depth });
    syncBody();
    return () => {
      mounted.delete(key);
      syncBody();
    };
  }, []);

  return <span ref={probe} hidden aria-hidden />;
}
