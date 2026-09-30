"use client";

import React from "react";
import { useElement, usePath, useReadOnly, useEditorRef } from "platejs/react";
import { Transforms } from "slate";
import { Trash as TrashIcon } from "iconoir-react";
import type { PlateNode } from "~/lib/wiki-os/transformers/plate-node";

/** What the read-only block is, in words the editor recognises. */
function constructLabel(el: PlateNode): string {
  switch (el.construct) {
    case "redirect":
      return "Redirect";
    case "comment":
      return "Comment";
    case "magic-word":
      return "Magic word";
    case "tag":
      return `<${el.tag ?? "tag"}>`;
    case "nested-table":
      return "Nested table";
    case "table-template":
    case "table-orphan-line":
      return "Table";
    default:
      return "Source";
  }
}

/**
 * Wikitext the visual editor cannot edit without changing it (a redirect, a comment, `<pre>`,
 * `<nowiki>`, a nested table, …). It is shown as source and saved back exactly as written; change
 * it in the source editor.
 */
export function PlateRawWikitextElement({
  attributes,
  children,
}: {
  attributes: Record<string, unknown>;
  children: React.ReactNode;
}) {
  const element = useElement() as PlateNode;
  const editor = useEditorRef();
  const path = usePath();
  const readOnly = useReadOnly();

  const handleDelete = () => {
    if (readOnly || !path) return;
    try {
      Transforms.removeNodes(editor as never, { at: path });
    } catch (e) {
      console.error("[PlateRawWikitext] Failed to remove block:", e);
    }
  };

  return (
    <div {...attributes} className="my-2 select-none">
      {/* Hidden children for Slate document invariants */}
      <span className="hidden">{children}</span>
      <div
        contentEditable={false}
        className="group relative rounded-xl border border-border/60 bg-card/75 px-3 py-2 text-xs shadow-xs backdrop-blur-xs transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:border-wiki/50 hover:bg-card/95"
      >
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-6 items-center justify-center rounded-lg border border-wiki/30 bg-wiki/10 px-2 font-mono text-xs font-bold tracking-wider text-wiki uppercase">
              {constructLabel(element)}
            </span>
            <span className="truncate text-muted-foreground">
              Read-only here. Saved exactly as written; edit it in the source editor.
            </span>
          </div>
          {!readOnly && (
            <button
              type="button"
              data-cuelume-press="droplet"
              onClick={handleDelete}
              className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:bg-destructive/10 hover:text-destructive active:scale-[0.97]"
              title="Remove this block"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <pre className="max-h-48 overflow-auto font-mono text-xs break-words whitespace-pre-wrap text-foreground/80">
          {element.rawWikitext}
        </pre>
      </div>
    </div>
  );
}
