"use client";

import React from "react";
import { useElement, usePath, useReadOnly } from "platejs/react";
import type { RawHtmlEl } from "../wiki-html";

export interface PlateWikiCallbacks {
  openTemplateEditor: (id: string) => void;
  deleteNode: (id: string) => void;
  updateInfoboxFields?: (id: string, fields: Array<{ label: string; value: string }>) => void;
}

const CallbacksCtx = React.createContext<PlateWikiCallbacks | null>(null);
export const PlateWikiCallbacksProvider = CallbacksCtx.Provider;
export function usePlateWikiCallbacks(): PlateWikiCallbacks {
  const ctx = React.useContext(CallbacksCtx);
  if (!ctx) throw new Error("PlateWikiCallbacks missing");
  return ctx;
}

/**
 * Shared atomic-block chrome: renders preserved original HTML verbatim
 * (data-mw lossless), with hover Edit/Delete affordances.
 */
export function AtomicBlock({
  html,
  kind,
  editableName,
}: {
  html: string;
  kind?: "infobox" | "generic" | "template";
  editableName?: string;
}) {
  return (
    <div
      className={`wikios-ve-atomic ${kind === "infobox" ? "wikios-ve-infobox" : "wikios-ve-template"} group relative my-2 rounded-xl`}
      contentEditable={false}
    >
      <div
        className="wikios-ve-atomic-body pointer-events-none [&_figure]:pointer-events-auto [&_img]:pointer-events-auto"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {editableName && (
        <span className="bg-wiki/15 text-wiki border-wiki/20 absolute -top-2 left-3 rounded-full border px-2 py-0.5 text-[10px] font-bold">
          {editableName}
        </span>
      )}
    </div>
  );
}

/** Escape-hatch / infobox block — original HTML re-emitted byte-for-byte on save. */
export function PlateRawHtmlElement({
  attributes,
  children,
}: {
  attributes: Record<string, unknown>;
  children: React.ReactNode;
}) {
  const el = useElement() as unknown as RawHtmlEl | undefined;
  const path = usePath();
  const readOnly = useReadOnly();
  const cb = usePlateWikiCallbacks();
  if (!el || !el.id) return <div {...attributes}>{children}</div>;
  return (
    <div {...attributes}>
      {children}
      <AtomicBlock html={el.html} kind={el.kind} editableName={el.name} />
      {!readOnly && el.name && (
        <div className="mt-1 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            contentEditable={false}
            onClick={() => path && cb.openTemplateEditor(el.id!)}
            className="bg-secondary/70 text-foreground rounded-lg px-2 py-0.5 text-[10px] font-semibold active:scale-[0.98]"
          >
            Edit
          </button>
          <button
            type="button"
            contentEditable={false}
            onClick={() => cb.deleteNode(el.id!)}
            className="rounded-lg bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-500 active:scale-[0.98]"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
