"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { OpenNewWindow } from "iconoir-react";
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
      <span role="status" className="text-footnote text-label-secondary tabular-nums">
        {words === 1 ? "1 word" : `${words} words`}
      </span>
      {/* The author's text goes over as their draft (never in the URL); see useLoreWriter. */}
      <Button asChild size="sm" variant="ghost">
        <Link href={pageEditHref(title, null, { mode: "visual" })} onClick={onOpenInWikiOS}>
          <OpenNewWindow aria-hidden="true" />
          Open in WikiOS
        </Link>
      </Button>
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
      <WikiEditBridge
        key={`${target.title}\n${target.prefill ?? ""}`}
        title={target.title}
        initialMode="visual"
        prefillWikitext={target.prefill}
        {...flow.bridge}
      />
    </div>
  );
}
