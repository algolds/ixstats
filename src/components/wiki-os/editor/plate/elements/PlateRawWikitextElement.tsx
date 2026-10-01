"use client";

import React, { useState } from "react";
import { useElement, usePath, useReadOnly, useEditorRef } from "platejs/react";
import { Transforms } from "slate";
import { Copy as CopyIcon, Trash as TrashIcon } from "iconoir-react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useNotify } from "~/hooks/useNotify";
import type { PlateNode } from "~/lib/wiki-os/transformers/plate-node";

interface ConstructInfo {
  label: string;
  /** What this block is and why it is not editable here, in full. */
  description: string;
}

const READ_ONLY = "It is saved exactly as written; edit it in the source editor.";

/** What the read-only block is, in words the editor recognises. */
function describeConstruct(el: PlateNode): ConstructInfo {
  switch (el.construct) {
    case "redirect":
      return {
        label: "Redirect",
        description: `This page redirects to another page. ${READ_ONLY}`,
      };
    case "comment":
      return {
        label: "Comment",
        description: `An HTML comment, invisible to readers. ${READ_ONLY}`,
      };
    case "magic-word":
      return {
        label: "Magic word",
        description: `A __MAGIC_WORD__ that changes how the page is displayed. ${READ_ONLY}`,
      };
    case "tag":
      return {
        label: `<${el.tag ?? "tag"}>`,
        description: `A <${el.tag ?? "tag"}> block whose content is literal text or belongs to an extension, so the visual editor cannot edit it without changing it. ${READ_ONLY}`,
      };
    case "nested-table":
      return { label: "Nested table", description: `A table inside a table cell. ${READ_ONLY}` };
    case "table-template":
    case "table-orphan-line":
      return {
        label: "Table",
        description: `A table with content the visual editor cannot edit without changing it (a template on its own line, or text outside any cell). ${READ_ONLY}`,
      };
    default:
      return {
        label: "Source",
        description: `Wikitext the visual editor cannot edit without changing it (it is unclosed or malformed). ${READ_ONLY}`,
      };
  }
}

/**
 * Wikitext the visual editor cannot edit without changing it (a redirect, a comment, `<pre>`,
 * `<nowiki>`, a nested table, …). It is shown as source and saved back exactly as written; change
 * it in the source editor. The source can be selected and copied, and removing the block asks first.
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
  const notify = useNotify();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { label, description } = describeConstruct(element);
  const source = element.rawWikitext ?? "";

  const handleDelete = () => {
    setConfirmOpen(false);
    if (readOnly || !path) return;
    try {
      Transforms.removeNodes(editor as never, { at: path });
    } catch (e) {
      console.error("[PlateRawWikitext] Failed to remove block:", e);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(source).then(
      () => notify.success("Copied", "The source is on the clipboard."),
      () => notify.error("Copy Failed", "Could not copy the source.")
    );
  };

  return (
    <div {...attributes} className="my-2">
      {/* Hidden children for Slate document invariants */}
      <span className="hidden">{children}</span>
      <div
        contentEditable={false}
        role="group"
        aria-label={`${label} block, read-only source`}
        tabIndex={0}
        title={description}
        className="group rounded-row border-separator bg-surface text-footnote shadow-card hover:border-tint/50 focus-visible:border-tint focus-visible:outline-tint relative border px-3 py-2 transition-[color,background-color,border-color,box-shadow,opacity,transform] focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <div className="mb-1.5 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <span className="border-wiki/30 bg-wiki/10 text-wiki flex h-6 shrink-0 items-center justify-center rounded-lg border px-2 font-mono text-xs font-bold tracking-wider uppercase select-none">
              {label}
            </span>
            {/* One line at rest; the whole text on hover and keyboard focus (and always as the tooltip). */}
            <span className="text-muted-foreground min-w-0 truncate pt-1 group-focus-within:overflow-visible group-focus-within:whitespace-normal group-hover:overflow-visible group-hover:whitespace-normal">
              {description}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              data-cuelume-press="droplet"
              onClick={handleCopy}
              aria-label={`Copy the source of this ${label} block`}
              title="Copy the source"
              className="text-muted-foreground hover:bg-secondary/60 hover:text-foreground flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.97]"
            >
              <CopyIcon className="h-3.5 w-3.5" />
            </button>
            {!readOnly && (
              <button
                type="button"
                data-cuelume-press="droplet"
                onClick={() => setConfirmOpen(true)}
                aria-label={`Remove this ${label} block`}
                title="Remove this block"
                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.97]"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        <pre
          tabIndex={0}
          aria-label={`Source of the ${label} block`}
          // A drag over the source selects text; the editor must not take it for a move of the block.
          onMouseDown={(event) => event.stopPropagation()}
          className="text-foreground/80 max-h-48 cursor-text overflow-auto font-mono text-xs break-words whitespace-pre-wrap select-text"
        >
          {source}
        </pre>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove this {label} block?</DialogTitle>
            <DialogDescription>
              Its source is deleted from the page when you save. {description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>
              Keep it
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
