"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { EditPencil } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { WikiEditBridge } from "~/components/wiki-os/editor/WikiEditBridge";
import type { LoreWriterFlow } from "~/hooks/lore/useLoreWriter";
import { pageEditHref } from "~/lib/wiki-os/page-tools";

/** The writer's header above the editor: WikiOS's editors fill the viewport less what is above them. */
const EDITOR_FRAME = { "--wikios-chrome-height": "4.5rem" } as CSSProperties;

/** The editor's tools in the writer's header: the word count and "Open in WikiOS". */
export function LoreEditorTools({
  title,
  words,
  onOpenInWikiOS,
}: {
  title: string;
  words: number;
  onOpenInWikiOS: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      {/* Read on demand, not announced on every keystroke. */}
      <span aria-live="off" className="text-footnote text-label-secondary tabular-nums">
        {words === 1 ? "1 word" : `${words} words`}
      </span>
      {/* The author's text goes over as their draft (never in the URL); see useLoreWriter. */}
      <Button asChild size="sm" variant="ghost">
        <Link href={pageEditHref(title, null, { mode: "visual" })} onClick={onOpenInWikiOS}>
          <EditPencil aria-hidden="true" />
          Open in WikiOS
        </Link>
      </Button>
    </div>
  );
}

/** The editor opened on the author's earlier draft of the title: say so, and let them start from the form instead. */
function RestoredDraftNotice({ onDiscard }: { onDiscard: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div
      role="status"
      className="rounded-row border-separator bg-surface text-footnote text-label flex flex-wrap items-center gap-2 border p-3"
    >
      <p className="min-w-0 flex-1">
        {confirming
          ? "Discard your draft and start from the form? The draft cannot be brought back."
          : "Your earlier draft of this page was restored."}
      </p>
      {confirming ? (
        <>
          <Button size="sm" variant="destructive" onClick={onDiscard}>
            Discard the draft
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
            Keep the draft
          </Button>
        </>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
          Start from the form instead
        </Button>
      )}
    </div>
  );
}

/** The lore writer's editor: WikiOS's own editing host, opened on the piece's starting text. */
export function LoreEditorStep({ flow }: { flow: LoreWriterFlow }) {
  const target = flow.target;
  if (!target) return null;
  return (
    <div className="wikios-root flex min-h-full flex-col gap-3 p-3" style={EDITOR_FRAME}>
      {flow.saveError && (
        <p
          role="alert"
          className="rounded-row border-red/30 bg-red/10 text-body text-label border p-3"
        >
          {flow.saveError}
        </p>
      )}
      {flow.restoredDraft && <RestoredDraftNotice onDiscard={flow.discardDraft} />}
      <WikiEditBridge
        key={`${flow.editorKey}\n${target.title}\n${target.prefill ?? ""}`}
        title={target.title}
        initialMode="visual"
        prefillWikitext={target.prefill}
        {...flow.bridge}
      />
    </div>
  );
}
