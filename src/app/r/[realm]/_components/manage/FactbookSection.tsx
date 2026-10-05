"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { ManageSection } from "./ManageSection";

// The WikiOS canvas editor is large; load it only when the Manage tab opens.
const WikiVisualEditor = dynamic(
  () => import("~/components/wiki-os/editor/WikiVisualEditor").then((m) => m.WikiVisualEditor),
  {
    ssr: false,
    loading: () => <p className="text-label-secondary text-footnote p-4">Loading editor…</p>,
  }
);

/** The factbook, written with the WikiOS canvas editor (or as wikitext source). */
export function FactbookSection({
  slug,
  realmName,
  factbook,
}: {
  slug: string;
  realmName: string;
  factbook: { wikitext: string; updatedAt: Date | null };
}) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [mode, setMode] = useState<"visual" | "source">("visual");
  const [source, setSource] = useState(factbook.wikitext);
  // The editor's latest complete wikitext; a ref so it doesn't re-seed the editor on every keystroke.
  const live = useRef<string>(factbook.wikitext);
  const save = api.realms.region.updateFactbook.useMutation({
    onSuccess: () => {
      notify.success("Factbook saved");
      void utils.realms.region.invalidate();
    },
    onError: (error) => notify.error("Could not save the factbook", error.message),
  });
  const current = () => (mode === "source" ? source : live.current);
  const switchMode = (next: "visual" | "source") => {
    if (next === "source") setSource(live.current);
    else live.current = source;
    setMode(next);
  };

  return (
    <ManageSection
      id="factbook"
      title="Factbook"
      description={`What visitors read first on ${realmName}'s page.${
        factbook.updatedAt
          ? ` Last saved ${new Date(factbook.updatedAt).toLocaleDateString()}.`
          : ""
      }`}
    >
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
        <Button
          size="sm"
          disabled={save.isPending}
          onClick={() => save.mutate({ slug, wikitext: current() })}
        >
          Save factbook
        </Button>
      </div>
      {mode === "visual" ? (
        <div className="border-separator rounded-row min-h-[320px] border p-2">
          <WikiVisualEditor
            key={`factbook:${slug}`}
            initialWikitext={live.current}
            title={`Realm factbook ${slug}`}
            onSave={async (wikitext) => {
              live.current = wikitext;
              save.mutate({ slug, wikitext });
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
          aria-label="Factbook wikitext"
        />
      )}
    </ManageSection>
  );
}
