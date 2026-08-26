"use client";

import React, { useEffect, useState } from "react";
import { useElement, useReadOnly } from "platejs/react";
import { PlateRawHtmlElement, AtomicBlock } from "./PlateRawHtmlElement";
import type { InfoboxBoxEl, TemplateEl } from "../wiki-html";
import { usePlateWikiCallbacks } from "./PlateRawHtmlElement";

/**
 * Structured, field-editable infobox card. Fields map to the article's
 * infobox rows (label/value); edits regenerate clean wikitext-compatible
 * table HTML at save time.
 */
export function PlateInfoboxBoxElement({ attributes, children }: { attributes: Record<string, unknown>; children: React.ReactNode }) {
  const el = useElement() as unknown as InfoboxBoxEl | undefined;
  const readOnly = useReadOnly();
  if (!el || !el.id) return <div {...attributes}>{children}</div>;
  return (
    <div {...attributes}>
      {children}
      <InfoboxCard el={el} readOnly={readOnly} />
    </div>
  );
}

function InfoboxCard({ el, readOnly }: { el: InfoboxBoxEl; readOnly: boolean }) {
  const cb = usePlateWikiCallbacks();
  const [fields, setFields] = useState(el.fields);
  const [showPreview, setShowPreview] = useState(false);

  // resync when node data changes externally (undo etc.)
  useEffect(() => setFields(el.fields), [el.fields]);

  const commit = (next: Array<{ label: string; value: string }>) => {
    setFields(next);
    cb.updateInfoboxFields?.(el.id!, next);
  };

  return (
    <div contentEditable={false} className="group relative my-3">
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-sm backdrop-blur-sm">
        {el.title && (
          <div className="border-b border-border/40 bg-wiki/10 px-4 py-2 text-center text-sm font-bold text-foreground">
            {el.title}
          </div>
        )}
        <table className="w-full text-xs">
          <tbody>
            {(showPreview && !readOnly ? fields : readOnly ? el.fields : fields).map((f, i) => (
              <tr key={i} className="border-b border-border/30 last:border-0">
                {f.label ? (
                  <th className="w-1/3 bg-secondary/30 px-3 py-1.5 text-left align-top font-semibold text-muted-foreground">{f.label}</th>
                ) : null}
                <td colSpan={f.label ? 1 : 2} className="px-3 py-1.5 align-top">
                  {!showPreview ? (
                    f.value
                  ) : (
                    <>
                      {f.label && (
                        <input
                          className="mr-1 w-1/3 rounded-md border border-border/50 bg-background px-1.5 py-0.5 font-semibold text-muted-foreground outline-none focus:border-wiki/60"
                          value={f.label}
                          onChange={(e) => {
                            const next = [...fields];
                            next[i] = { ...next[i]!, label: e.target.value };
                            commit(next);
                          }}
                        />
                      )}
                      <input
                        className="w-full flex-1 rounded-md border border-border/50 bg-background px-1.5 py-0.5 text-foreground outline-none focus:border-wiki/60"
                        value={f.value}
                        onChange={(e) => {
                          const next = [...fields];
                          next[i] = { ...next[i]!, value: e.target.value };
                          commit(next);
                        }}
                      />
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!readOnly && (
          <div className="flex justify-end gap-2 border-t border-border/40 bg-secondary/20 px-3 py-1.5">
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="rounded-lg bg-secondary/70 px-2.5 py-1 text-[10px] font-bold text-foreground active:scale-[0.98]"
            >
              {showPreview ? "Done" : "Edit fields"}
            </button>
            <button
              type="button"
              onClick={() => cb.deleteNode(el.id!)}
              className="rounded-lg bg-red-500/10 px-2.5 py-1 text-[10px] font-bold text-red-500 active:scale-[0.98]"
            >
              Remove
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

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
