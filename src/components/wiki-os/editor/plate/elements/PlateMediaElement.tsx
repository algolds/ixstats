"use client";

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
    cb = usePlateWikiCallbacks();
  } catch {}

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
            className="wikios-ve-media overflow-hidden rounded-xl [&_figure]:m-0 [&_img]:max-w-full"
            dangerouslySetInnerHTML={{ __html: el.html }}
          />
        ) : (
          <figure
            className={`overflow-hidden rounded-xl border border-border/40 bg-secondary/20 p-2 ${
              align === "left"
                ? "float-left mr-4 mb-2 max-w-sm"
                : align === "right" || align === "thumb"
                ? "float-right ml-4 mb-2 max-w-sm"
                : "mx-auto max-w-lg"
            }`}
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={caption || filename}
                className="w-full h-auto rounded-lg object-contain"
                loading="lazy"
              />
            ) : (
              <div className="flex h-32 items-center justify-center rounded-lg bg-secondary/50 text-muted-foreground text-xs font-mono">
                {filename || "Media File"}
              </div>
            )}
            {caption && (
              <figcaption className="mt-1.5 text-center text-xs text-muted-foreground">
                {caption}
              </figcaption>
            )}
          </figure>
        )}
        {!readOnly && (
          <button
            type="button"
            onClick={handleDelete}
            className="absolute top-2 right-2 rounded-lg bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100 active:scale-[0.98] z-10"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
