"use client";

import React from "react";
import { useElement, usePath, useReadOnly } from "platejs/react";
import { usePlateWikiCallbacks } from "./PlateRawHtmlElement";
import type { MediaEl } from "../wiki-html";

/** Stashed/Commons media block — original figure HTML preserved verbatim. */
export function PlateMediaElement({ attributes, children }: { attributes: Record<string, unknown>; children: React.ReactNode }) {
  const el = useElement() as unknown as MediaEl | undefined;
  // oxlint-disable-next-line eslint/no-unused-vars
  const path = usePath();
  const readOnly = useReadOnly();
  const cb = usePlateWikiCallbacks();
  if (!el || !el.id) return <div {...attributes}>{children}</div>;
  return (
    <div {...attributes}>
      {children}
      <div contentEditable={false} className="group relative my-2">
        <div className="wikios-ve-media overflow-hidden rounded-xl [&_img]:max-w-full [&_figure]:m-0" dangerouslySetInnerHTML={{ __html: el.html }} />
        {!readOnly && (
          <button
            type="button"
            onClick={() => cb.deleteNode(el.id!)}
            className="absolute right-2 top-2 rounded-lg bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100 active:scale-[0.98]"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
