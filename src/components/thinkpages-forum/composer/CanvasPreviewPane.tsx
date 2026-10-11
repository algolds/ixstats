"use client";

import { Signal } from "~/components/ui/signal";
import { Skeleton } from "~/components/ui/skeleton";
import { PostBody } from "../thread/PostBody";
import type { PostStyle } from "../thread/types";
import { FORMATTING_LATER } from "./canvas-copy";
import type { CanvasPreview } from "./useCanvasPreview";

/** The Preview tab: the server's render of the draft as it would read in the thread. */
export function CanvasPreviewPane({
  preview,
  postStyle,
}: {
  preview: CanvasPreview | null;
  postStyle: PostStyle;
}) {
  return (
    <div aria-live="polite" className="min-h-24 px-1">
      {preview?.kind === "ready" ? (
        <>
          {preview.pending ? (
            <Signal tone="info" title={FORMATTING_LATER} className="mb-3">
              The wiki is busy, so this preview is approximate.
            </Signal>
          ) : null}
          <PostBody html={preview.html} style={postStyle} />
        </>
      ) : null}
      {preview?.kind === "error" ? <Signal tone="destructive" title={preview.message} /> : null}
      {preview?.kind === "loading" ? <Skeleton aria-busy="true" className="h-24 w-full" /> : null}
    </div>
  );
}
