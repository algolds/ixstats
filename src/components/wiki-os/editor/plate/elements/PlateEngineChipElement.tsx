"use client";

import React from "react";
import { useElement, usePath, useReadOnly } from "platejs/react";
import { usePlateWikiCallbacks } from "./PlateRawHtmlElement";
import type { ChipEngineEl } from "../wiki-html";
import { Button } from "~/components/ui/button";

const chipTone: Record<string, string> = {
  CountryData: "border-yellow/30 bg-yellow/10 text-yellow",
  BusinessData: "border-green/30 bg-green/10 text-green",
  MyCountry: "border-tint/30 bg-tint/10 text-tint",
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
        className={`text-caption inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold ${chipTone[family] ?? "border-separator bg-fill-3 text-label"}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />⚡ {el.label}
        {!readOnly && path && (
          <Button
            variant="link"
            size="sm"
            onClick={() => cb.openTemplateEditor(el.id!)}
            className="text-footnote ml-0.5 h-auto px-1 text-inherit underline opacity-60 hover:opacity-100"
          >
            edit
          </Button>
        )}
      </span>
    </span>
  );
}
