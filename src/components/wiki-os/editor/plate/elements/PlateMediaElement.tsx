"use client";

import { cn } from "~/lib/utils";
import React from "react";
import { useElement, usePath, useReadOnly, useEditorRef } from "platejs/react";
import { Transforms } from "slate";
import { usePlateWikiCallbacks } from "./PlateRawHtmlElement";
import { resolveImageUrl } from "~/lib/wiki-os/transformers/image-url";

/** Stashed/Commons media block — original figure HTML or AST-resolved image rendered. */
export function PlateMediaElement({
  attributes,
  children,
}: {
  attributes: Record<string, unknown>;
  children: React.ReactNode;
}) {
  const el = useElement() as any;
  const path = usePath();
  const editor = useEditorRef();
  const readOnly = useReadOnly();
  let cb: ReturnType<typeof usePlateWikiCallbacks> | null = null;
  try {
    // Always called (the try only catches the missing-provider throw), so the hook order is stable.
    // oxlint-disable-next-line react-hooks/rules-of-hooks
    cb = usePlateWikiCallbacks();
  } catch {
    // rendered outside the PlateWikiCallbacks provider — media callbacks disabled
  }

  if (!el) return <div {...attributes}>{children}</div>;

  const handleDelete = () => {
    if (el.id && cb) {
      cb.deleteNode(el.id);
    } else if (path) {
      try {
        Transforms.removeNodes(editor as any, { at: path });
      } catch (e) {
        console.error("[PlateMediaElement] Failed to remove media node:", e);
      }
    }
  };

  const filename = el.filename || "";
  const imageUrl = resolveImageUrl(filename);
  const caption = el.caption;
  const align = el.align || "thumb";

  return (
    <div {...attributes} className="my-3">
      {children}
      <div contentEditable={false} className="group relative">
        {el.html ? (
          <div
            className="wikios-ve-media rounded-row overflow-hidden [&_figure]:m-0 [&_img]:max-w-full"
            dangerouslySetInnerHTML={{ __html: el.html }}
          />
        ) : (
          <figure
            className={cn(
              "rounded-row border-separator bg-fill-4 overflow-hidden border p-2",
              align === "left"
                ? "float-left mr-4 mb-2 max-w-sm"
                : align === "right" || align === "thumb"
                  ? "float-right mb-2 ml-4 max-w-sm"
                  : "mx-auto max-w-lg"
            )}
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={caption || filename}
                className="rounded-control h-auto w-full object-contain"
                loading="lazy"
              />
            ) : (
              <div className="rounded-control bg-fill-3 text-label-secondary text-footnote flex h-32 items-center justify-center tabular-nums">
                {filename || "Media File"}
              </div>
            )}
            {caption && (
              <figcaption className="text-footnote text-label-secondary mt-1.5 text-center">
                {caption}
              </figcaption>
            )}
          </figure>
        )}
        {!readOnly && (
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-control text-caption absolute top-2 right-2 z-10 bg-black/60 px-2 py-0.5 font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 active:scale-[0.98]"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
