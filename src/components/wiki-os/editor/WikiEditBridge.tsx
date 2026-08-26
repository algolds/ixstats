"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { api } from "~/trpc/react";
import { saveDraft, getDraft, clearDraft } from "~/lib/wiki-os/editor/draft-store";
import type { WikitextSerializeResult } from "./plate/wiki-wikitext";

const WikiVisualEditor = dynamic(
  () => import("~/components/wiki-os/editor/WikiVisualEditor").then((m) => m.WikiVisualEditor),
  { loading: () => <EditorLoading text="Loading visual editor..." />, ssr: false }
);

const WikiSourceEditor = dynamic(
  () => import("~/components/wiki-os/editor/WikiSourceEditor").then((m) => m.WikiSourceEditor),
  { loading: () => <EditorLoading text="Loading source editor..." />, ssr: false }
);

function EditorLoading({ text = "Loading editor..." }: { text?: string }) {
  return (
    <div className="wikios-loading flex min-h-[400px] flex-col items-center justify-center">
      <div className="wikios-loading-spinner" />
      <p className="mt-4 text-sm text-zinc-400">{text}</p>
    </div>
  );
}

interface WikiEditBridgeProps {
  title: string;
  initialMode?: "source" | "visual";
  onClose: () => void;
  onSaveSuccess?: () => void;
}

export function WikiEditBridge({
  title,
  initialMode = "source",
  onClose,
  onSaveSuccess,
}: WikiEditBridgeProps) {
  const [mode, setMode] = useState<"source" | "visual">(initialMode);
  const [_saving, setSaving] = useState(false);
  const [editConflict, setEditConflict] = useState(false);
  const [activeWikitext, setActiveWikitext] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);

  // Single Authoritative Fetch via getWikitext (read-through Postgres + MediaWiki fallback)
  const {
    data: wikitextData,
    isLoading: wtLoading,
    refetch: refetchWikitext,
  } = api.wikios.getWikitext.useQuery(
    { title },
    { staleTime: 5 * 60 * 1000 }
  );

  const saveWikitext = api.wikios.saveWikitext.useMutation();

  // Restore draft from canonical draft store
  useEffect(() => {
    const localDraft = getDraft(title);
    if (localDraft && !draftRestored) {
      if (localDraft.wikitext) {
        // oxlint-disable-next-line
        setActiveWikitext(localDraft.wikitext);
      }
      if (localDraft.mode) {
        setMode(localDraft.mode);
      }
      setDraftRestored(true);
    }
  }, [title, draftRestored]);

  // Instant In-Memory Mode Switching (Invariant 3 & Invariant 7)
  const handleModeSwitch = useCallback(
    (newMode: "source" | "visual", dirty: boolean, currentContent: string) => {
      if (newMode === mode) return;

      if (dirty) {
        setActiveWikitext(currentContent);
        saveDraft({
          title,
          source: "ixwiki",
          mode: newMode,
          wikitext: currentContent,
        });
      }
      setMode(newMode);
    },
    [mode, title]
  );

  const lastSerializedRef = useRef<WikitextSerializeResult | null>(null);
  const setLastSerialized = useCallback((result: WikitextSerializeResult) => {
    lastSerializedRef.current = result;
  }, []);

  const handleVisualSave = useCallback(
    async (content: string, summary: string, minor: boolean, keepEditing?: boolean) => {
      setSaving(true);
      setEditConflict(false);
      try {
        const wikitextToSave = lastSerializedRef.current?.wikitext || content;
        const result = await saveWikitext.mutateAsync({
          title,
          wikitext: wikitextToSave,
          summary,
          minor,
          basetimestamp: wikitextData?.timestamp ?? undefined,
        });

        if ((result as { editConflict?: boolean }).editConflict) {
          setEditConflict(true);
          throw new Error("Edit conflict detected: this page was modified by another user.");
        }

        clearDraft(title);

        if (keepEditing) {
          const res = await refetchWikitext();
          if (res.data) {
            setActiveWikitext(res.data.wikitext);
          }
        } else {
          onSaveSuccess?.();
          onClose();
        }
      } catch (err) {
        console.error("Failed to save article:", err);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [title, wikitextData, saveWikitext, refetchWikitext, onSaveSuccess, onClose]
  );

  const handleSourceSave = useCallback(
    async (wikitext: string, summary: string, minor: boolean, keepEditing?: boolean) => {
      setSaving(true);
      setEditConflict(false);
      try {
        const result = await saveWikitext.mutateAsync({
          title,
          wikitext,
          summary,
          minor,
          basetimestamp: wikitextData?.timestamp ?? undefined,
        });

        if ((result as { editConflict?: boolean }).editConflict) {
          setEditConflict(true);
          throw new Error("Edit conflict detected: this page was modified by another user.");
        }

        clearDraft(title);

        if (keepEditing) {
          const res = await refetchWikitext();
          if (res.data) {
            setActiveWikitext(res.data.wikitext);
          }
        } else {
          onSaveSuccess?.();
          onClose();
        }
      } catch (err) {
        console.error("Failed to save wikitext:", err);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [title, wikitextData, saveWikitext, refetchWikitext, onSaveSuccess, onClose]
  );

  if (wtLoading && activeWikitext === null) {
    return <EditorLoading text="Loading article..." />;
  }

  const initialWikitextValue = activeWikitext ?? wikitextData?.wikitext ?? "";

  return (
    <div className="wikios-edit-bridge relative min-h-[600px] w-full">
      {editConflict && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          <strong>Edit Conflict Detected:</strong> Someone else modified this page since you opened
          it. Please review your edits before saving.
        </div>
      )}

      {mode === "visual" ? (
        <WikiVisualEditor
          title={title}
          initialWikitext={initialWikitextValue}
          onSave={handleVisualSave}
          onCancel={onClose}
          onSwitchToSource={(dirty, content) => handleModeSwitch("source", dirty, content)}
          onSerializedWikitext={setLastSerialized}
        />
      ) : (
        <WikiSourceEditor
          title={title}
          initialWikitext={initialWikitextValue}
          onSave={handleSourceSave}
          onCancel={onClose}
          onSwitchToVisual={(dirty, wt) => handleModeSwitch("visual", dirty, wt)}
        />
      )}
    </div>
  );
}
