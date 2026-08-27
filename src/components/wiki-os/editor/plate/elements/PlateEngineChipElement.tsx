"use client";

import React from "react";
import { useElement, usePath, useReadOnly } from "platejs/react";
import { usePlateWikiCallbacks } from "./PlateRawHtmlElement";
import type { ChipEngineEl } from "../wiki-html";

const chipTone: Record<string, string> = {
  CountryData: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  BusinessData: "border-teal-400/30 bg-teal-400/10 text-teal-300",
  MyCountry: "border-wiki/30 bg-wiki/10 text-wiki",
};

/** Live simulation metric badge (CountryData / BusinessData / MyCountry). */
export function PlateEngineChipElement({
  attributes,
  children,
}: {
  attributes: Record<string, unknown>;
  children: React.ReactNode;
}) {
  const el = useElement() as unknown as ChipEngineEl | undefined;
  const path = usePath();
  const readOnly = useReadOnly();
  const cb = usePlateWikiCallbacks();
  if (!el || !el.id) return <span {...attributes}>{children}</span>;
  const family = el.name.split(":")[0] ?? el.name;
  return (
    <span {...attributes} className="relative inline-block align-baseline">
      {children}
      <span
        contentEditable={false}
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${chipTone[family] ?? "border-border bg-secondary text-foreground"}`}
      >
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current opacity-70" />⚡{" "}
        {el.label}
        {!readOnly && path && (
          <button
            type="button"
            onClick={() => cb.openTemplateEditor(el.id!)}
            className="ml-0.5 rounded px-1 text-[9px] underline opacity-60 hover:opacity-100 active:scale-[0.98]"
          >
            edit
          </button>
        )}
      </span>
    </span>
  );
}
