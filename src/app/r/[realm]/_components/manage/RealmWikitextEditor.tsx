"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { SegmentedControl } from "~/components/ui/segmented-control";
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
 * Realm text written with the WikiOS canvas editor (or as wikitext source): the factbook and the rules. The
 * server renders and sanitizes what `onSave` sends. The canvas is hosted bare, as the forum composer hosts it:
 * this Save is the only save, and the server text is always where it starts (no local wiki draft).
 */
export function RealmWikitextEditor({
  editorKey,
  editorTitle,
  initialWikitext,
  saveLabel,
  sourceLabel,
  saving,
  onSave,
}: {
  /** Keeps one editor instance per document. */
  editorKey: string;
  editorTitle: string;
  initialWikitext: string;
  saveLabel: string;
  sourceLabel: string;
  saving: boolean;
  onSave: (wikitext: string) => void;
}) {
  const [mode, setMode] = useState<"visual" | "source">("visual");
  const [source, setSource] = useState(initialWikitext);
  // The editor's latest complete wikitext; a ref so it doesn't re-seed the editor on every keystroke.
  const live = useRef<string>(initialWikitext);
  // False while some canvas content has no wikitext form: `live` is then behind the canvas, so neither
  // saving nor switching to source may read it.
  const [complete, setComplete] = useState(true);
  const blocked = mode === "visual" && !complete;
  const current = () => (mode === "source" ? source : live.current);
  const switchMode = (next: "visual" | "source") => {
    if (next === "source") setSource(live.current);
    else live.current = source;
    setMode(next);
  };

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <SegmentedControl
          aria-label="Editor mode"
          size="sm"
          value={mode}
          onValueChange={switchMode}
          options={[
            { value: "visual", label: "Canvas" },
            { value: "source", label: "Wikitext", disabled: blocked },
          ]}
        />
        <Button size="sm" disabled={saving || blocked} onClick={() => onSave(current())}>
          {saveLabel}
        </Button>
      </div>
      {blocked && (
        <Signal tone="warning" title="Part of this cannot be saved yet" className="mb-3">
          Something in it has no wikitext form. Remove or retype it to continue.
        </Signal>
      )}
      {mode === "visual" ? (
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
      ) : (
        <Textarea
          value={source}
          onChange={(e) => setSource(e.target.value)}
          rows={16}
          className="font-mono"
          aria-label={sourceLabel}
        />
      )}
    </>
  );
}
