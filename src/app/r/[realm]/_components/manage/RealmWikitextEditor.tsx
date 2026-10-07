"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { SegmentedControl } from "~/components/ui/segmented-control";

// The WikiOS canvas editor is large; load it only when the Manage tab opens.
const WikiVisualEditor = dynamic(
  () => import("~/components/wiki-os/editor/WikiVisualEditor").then((m) => m.WikiVisualEditor),
  {
    ssr: false,
    loading: () => <p className="text-label-secondary text-footnote p-4">Loading editor…</p>,
  }
);

/**
 * Realm text written with the WikiOS canvas editor (or as wikitext source): the factbook and the rules. The
 * server renders and sanitizes what `onSave` sends.
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
            { value: "source", label: "Wikitext" },
          ]}
        />
        <Button size="sm" disabled={saving} onClick={() => onSave(current())}>
          {saveLabel}
        </Button>
      </div>
      {mode === "visual" ? (
        <div className="border-separator rounded-row min-h-[320px] border p-2">
          <WikiVisualEditor
            key={editorKey}
            initialWikitext={live.current}
            title={editorTitle}
            onSave={async (wikitext) => {
              live.current = wikitext;
              onSave(wikitext);
            }}
            onCancel={() => undefined}
            onSwitchToSource={(_dirty, content) => {
              setSource(content);
              setMode("source");
            }}
            onSerializedWikitext={(result) => {
              if (result.complete) live.current = result.wikitext;
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
