"use client";

import React from "react";

/** The Halo island's tinted glow underlay; render it as the first child of the island surface. */
export function DynamicIslandEffects() {
  return (
    <span
      aria-hidden="true"
      className="bg-tint/20 pointer-events-none absolute inset-0 -z-10 rounded-[inherit] opacity-40 blur-xl print:hidden"
    />
  );
}
