"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "~/components/ui/button";
import { Signal } from "~/components/ui/signal";

// The WikiOS canvas editor is large; load it only when the Manage tab opens.
const WikiVisualEditor = dynamic(
  () => import("~/components/wiki-os/editor/WikiVisualEditor").then((m) => m.WikiVisualEditor),
  {
    ssr: false,
    loading: () => <p className="text-label-secondary text-footnote p-4">Loading editor…</p>,
  }
);

const NOOP = () => undefined;

/**
 * Realm text written with the WikiOS canvas editor: the factbook and the rules. The
 * server renders and sanitizes what `onSave` sends. The canvas is hosted bare, as the forum composer hosts it:
 * this Save is the only save, and the server text is always where it starts (no local wiki draft).
 */
export function RealmWikitextEditor({
  editorKey,
  editorTitle,
  initialWikitext,
  saveLabel,
  saving,
  onSave,
}: {
  /** Keeps one editor instance per document. */
  editorKey: string;
  editorTitle: string;
  initialWikitext: string;
  saveLabel: string;
  saving: boolean;
  onSave: (wikitext: string) => void;
}) {
  // The editor's latest complete wikitext; a ref so it doesn't re-seed the editor on every keystroke.
  const live = useRef<string>(initialWikitext);
  // False while some canvas content has no wikitext form: `live` is then behind the canvas, so saving may
  // not read it.
  const [complete, setComplete] = useState(true);

  return (
    <>
      <div className="mb-3 flex items-center justify-end gap-2">
        <Button size="sm" disabled={saving || !complete} onClick={() => onSave(live.current)}>
          {saveLabel}
        </Button>
      </div>
      {!complete && (
        <Signal tone="warning" title="Part of this cannot be saved yet" className="mb-3">
          Something in it has no wikitext form. Remove or retype it to continue.
        </Signal>
      )}
      <div className="border-separator rounded-row min-h-[320px] overflow-hidden border">
        <WikiVisualEditor
          key={editorKey}
          bare
          // The Manage column is too narrow for the full toolbar; link and image stay in view, the rest is under More.
          compactToolbar
          initialWikitext={live.current}
          title={editorTitle}
          restoreLocalDraft={false}
          onSave={NOOP}
          onCancel={NOOP}
          onSwitchToSource={NOOP}
          onSerializedWikitext={(result) => {
            if (result.complete) live.current = result.wikitext;
            setComplete(result.complete);
          }}
        />
      </div>
    </>
  );
}
