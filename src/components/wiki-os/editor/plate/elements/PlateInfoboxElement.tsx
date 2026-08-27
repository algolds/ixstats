"use client";

import React, { useEffect, useState } from "react";
import { useElement, useReadOnly } from "platejs/react";
import { PlateRawHtmlElement } from "./PlateRawHtmlElement";
import type { InfoboxBoxEl } from "../wiki-html";
import { usePlateWikiCallbacks } from "./PlateRawHtmlElement";

/**
 * Structured, field-editable infobox card. Fields map to the article's
 * infobox rows (label/value); edits regenerate clean wikitext-compatible
 * table HTML at save time.
 */
export function PlateInfoboxBoxElement({
  attributes,
  children,
}: {
  attributes: Record<string, unknown>;
  children: React.ReactNode;
}) {
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
  // oxlint-disable-next-line
  useEffect(() => setFields(el.fields), [el.fields]);

  const commit = (next: Array<{ label: string; value: string }>) => {
    setFields(next);
    cb.updateInfoboxFields?.(el.id!, next);
  };

  return (
    <div contentEditable={false} className="group relative my-3">
      <div className="border-border/60 bg-card/80 overflow-hidden rounded-2xl border shadow-sm backdrop-blur-sm">
        {el.title && (
          <div className="border-border/40 bg-wiki/10 text-foreground border-b px-4 py-2 text-center text-sm font-bold">
            {el.title}
          </div>
        )}
        <table className="w-full text-xs">
          <tbody>
            {(showPreview && !readOnly ? fields : readOnly ? el.fields : fields).map((f, i) => (
              <tr key={i} className="border-border/30 border-b last:border-0">
                {f.label ? (
                  <th className="bg-secondary/30 text-muted-foreground w-1/3 px-3 py-1.5 text-left align-top font-semibold">
                    {f.label}
                  </th>
                ) : null}
                <td colSpan={f.label ? 1 : 2} className="px-3 py-1.5 align-top">
                  {!showPreview ? (
                    f.value
                  ) : (
                    <>
                      {f.label && (
                        <input
                          className="border-border/50 bg-background text-muted-foreground focus:border-wiki/60 mr-1 w-1/3 rounded-md border px-1.5 py-0.5 font-semibold outline-none"
                          value={f.label}
                          onChange={(e) => {
                            const next = [...fields];
                            next[i] = { ...next[i]!, label: e.target.value };
                            commit(next);
                          }}
                        />
                      )}
                      <input
                        className="border-border/50 bg-background text-foreground focus:border-wiki/60 w-full flex-1 rounded-md border px-1.5 py-0.5 outline-none"
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
          <div className="border-border/40 bg-secondary/20 flex justify-end gap-2 border-t px-3 py-1.5">
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="bg-secondary/70 text-foreground rounded-lg px-2.5 py-1 text-[10px] font-bold active:scale-[0.98]"
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
export function PlateInfoboxElement(props: {
  attributes: Record<string, unknown>;
  children: React.ReactNode;
}) {
  return <PlateRawHtmlElement {...props} />;
}
