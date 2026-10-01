"use client";

import { useEffect } from "react";
import { ONOMA_TINT_SLOTS } from "../../onoma-tint";

/**
 * Radix portals (dialogs, sheets, popovers, menus, tooltips) render into <body>, outside Onoma's
 * wrapper. The Labs `PortalTintSync` already mirrors `data-app="maps"` onto <body>; this mirrors
 * Onoma's inline tint slots too, so portalled surfaces resolve `--tint` (focus, selection, tinted
 * controls) to the Onoma azure instead of the Labs sky while the lab is mounted. The [data-app]
 * rules derive `--tint` from these slots on <body> itself, so appearance and Increase Contrast
 * still switch them. Restores whatever <body> had on unmount.
 */
export function OnomaPortalTint() {
  useEffect(() => {
    const { style } = document.body;
    const previous = Object.keys(ONOMA_TINT_SLOTS).map(
      (name) => [name, style.getPropertyValue(name)] as const
    );
    for (const [name, value] of Object.entries(ONOMA_TINT_SLOTS)) style.setProperty(name, value);
    return () => {
      for (const [name, value] of previous) {
        if (value) style.setProperty(name, value);
        else style.removeProperty(name);
      }
    };
  }, []);

  return null;
}
