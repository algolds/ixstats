"use client";

import React from "react";
import { useElement } from "platejs/react";
import type { ChipCoordEl, ChipMapEmbedEl } from "../wiki-html";

/** Interactive 📍 coordinate badge with title-tooltip preview. */
export function PlateCoordChipElement({
  attributes,
  children,
}: {
  attributes: Record<string, unknown>;
  children: React.ReactNode;
}) {
  const el = useElement() as unknown as ChipCoordEl | undefined;
  if (!el) return <span {...attributes}>{children}</span>;
  return (
    <span {...attributes} className="relative inline-block align-baseline">
      {children}
      <a
        contentEditable={false}
        href={el.href}
        title={el.title}
        onClick={(e) => e.preventDefault()}
        className="wikios-ve-custom-chip chip-coords border-yellow/30 bg-yellow/10 text-caption text-yellow inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold"
      >
        <span className="opacity-70">📍</span> {el.label}
      </a>
    </span>
  );
}

/** Interactive 🗺️ map-embed badge. */
export function PlateMapEmbedChipElement({
  attributes,
  children,
}: {
  attributes: Record<string, unknown>;
  children: React.ReactNode;
}) {
  const el = useElement() as unknown as ChipMapEmbedEl | undefined;
  if (!el) return <span {...attributes}>{children}</span>;
  return (
    <span {...attributes} className="relative inline-block align-baseline">
      {children}
      <a
        contentEditable={false}
        href={el.href}
        title={el.title}
        onClick={(e) => e.preventDefault()}
        className="wikios-ve-custom-chip chip-mapembed border-teal/30 bg-teal/10 text-caption text-teal inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold"
      >
        <span className="opacity-70">🗺️</span> Map Embed
      </a>
    </span>
  );
}
