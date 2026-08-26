"use client";

import React from "react";
import { PlateRawHtmlElement, AtomicBlock } from "./PlateRawHtmlElement";
import type { TemplateEl } from "../wiki-html";

/** Atomic infobox/template transclusion — original Parsoid HTML preserved verbatim. */
export function PlateInfoboxElement(props: { attributes: Record<string, unknown>; children: React.ReactNode }) {
  return <PlateRawHtmlElement {...props} />;
}

export { AtomicBlock };

export function TemplatePreview({ el }: { el: TemplateEl }) {
  if (el.html) return <AtomicBlock html={el.html} kind="template" editableName={el.name} />;
  return (
    <div className="wikios-ve-template my-2 rounded-xl border border-border/40 bg-card/60 p-3" contentEditable={false}>
      <span className="text-xs font-bold text-muted-foreground">{`{{${el.name}}}`}</span>
    </div>
  );
}
