"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import {
  saveDraft,
  getDraft,
  clearDraft,
  clearEditorBase,
  isDraftStale,
  setEditorBase,
  type WikiEditorDraft,
} from "~/lib/wiki-os/editor/draft-store";
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
  /** Heading text to open the source editor at. */
  initialSection?: string;
  onClose: () => void;
  onSaveSuccess?: () => void;
}

/** The page as the editor was opened on: the text and the revision that text is the content of. */
interface LoadedPage {
  wikitext: string;
  revisionRef: string | null;
  /** Every reference that names that revision (its row id, and its MediaWiki rev_id once stamped). */
  revisionRefs: string[];
}

/** The revision a server answer names, as the editor keeps it. */
const revisionOf = (ref: string | null, refs?: string[]): Pick<LoadedPage, "revisionRef" | "revisionRefs"> => ({
  revisionRef: ref,
  revisionRefs: refs ?? (ref === null ? [] : [ref]),
});

/** A save the server refused because the page changed: the page as it is now. */
interface ConflictState {
  currentWikitext: string;
  currentRevisionRef: string | null;
}

interface PendingSave {
  wikitext: string;
  summary: string;
  minor: boolean;
  keepEditing?: boolean;
}

export function WikiEditBridge({
  title,
  initialMode = "source",
  initialSection,
  onClose,
  onSaveSuccess,
}: WikiEditBridgeProps) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [mode, setMode] = useState<"source" | "visual">(initialMode);
  const [_saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<ConflictState | null>(null);
  const [activeWikitext, setActiveWikitext] = useState<string | null>(null);
  /** Frozen when the editor opens (later refetches must not move the base under the user's text). */
  const [loaded, setLoaded] = useState<LoadedPage | null>(null);
  const [staleDraft, setStaleDraft] = useState<WikiEditorDraft | null>(null);
  const [draftResolved, setDraftResolved] = useState(false);
  /** Changes when the editors must start over from new text (Load current version). */
  const [editorKey, setEditorKey] = useState(0);
  const pendingSave = useRef<PendingSave | null>(null);

  // Single Authoritative Fetch via getWikitext (read-through Postgres + MediaWiki fallback)
  const {
    data: wikitextData,
    isLoading: wtLoading,
    refetch: refetchWikitext,
  } = api.wikios.getWikitext.useQuery({ title }, { staleTime: 5 * 60 * 1000 });

  const saveWikitext = api.wikios.saveWikitext.useMutation();

  if (loaded === null && !wtLoading) {
    setLoaded({
      wikitext: wikitextData?.wikitext ?? "",
      ...revisionOf(wikitextData?.revisionRef ?? null, wikitextData?.revisionRefs),
    });
  }

  // Drafts saved from any editor component are stamped with the revision this editor was loaded from.
  useEffect(() => {
    if (loaded === null) return;
    setEditorBase(title, loaded.revisionRef);
    return () => clearEditorBase(title);
  }, [title, loaded]);

  const restoreDraft = useCallback((draft: WikiEditorDraft) => {
    if (draft.wikitext) setActiveWikitext(draft.wikitext);
    if (draft.mode) setMode(draft.mode);
  }, []);

  // A local draft is restored only while the page has not changed since it was written; a draft
  // that is older than the published page waits for the author's decision instead of replacing it.
  useEffect(() => {
    if (loaded === null || draftResolved) return;
    // The draft lives in localStorage, an external store this effect synchronises with.
    const draft = getDraft(title);
    if (!draft || !(draft.wikitext || draft.html)) {
      // oxlint-disable-next-line react/set-state-in-effect
      setDraftResolved(true);
    } else if (draft.wikitext !== loaded.wikitext && isDraftStale(draft, loaded.revisionRefs)) {
      // (A draft that equals the published text loses nothing whichever way it is restored.)
      setStaleDraft(draft);
    } else {
      restoreDraft(draft);
      setDraftResolved(true);
    }
  }, [title, loaded, draftResolved, restoreDraft]);

  // Restoring an old draft edits the text it was written on, so a save is checked against that revision.
  const handleRestoreStaleDraft = useCallback(() => {
    if (!staleDraft) return;
    restoreDraft(staleDraft);
    setLoaded((prev) => ({
      wikitext: prev?.wikitext ?? "",
      ...revisionOf(staleDraft.baseRevisionRef ?? null),
    }));
    setStaleDraft(null);
    setDraftResolved(true);
  }, [staleDraft, restoreDraft]);

  const handleDiscardStaleDraft = useCallback(() => {
    clearDraft(title);
    setStaleDraft(null);
    setDraftResolved(true);
  }, [title]);

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

  const performSave = useCallback(
    async (save: PendingSave, baseRevisionRef: string | null) => {
      setSaving(true);
      setConflict(null);
      try {
        const result = await saveWikitext.mutateAsync({
          title,
          wikitext: save.wikitext,
          summary: save.summary,
          minor: save.minor,
          baseRevisionRef: baseRevisionRef ?? undefined,
        });

        if (!result.success) {
          pendingSave.current = save;
          setConflict({
            currentWikitext: result.currentWikitext,
            currentRevisionRef: result.currentRevisionRef,
          });
          throw new Error("Edit conflict detected: this page was modified by another user.");
        }

        pendingSave.current = null;
        clearDraft(title);

        if (save.keepEditing) {
          // The next save builds on this one.
          const res = await refetchWikitext();
          if (res.data) {
            setActiveWikitext(res.data.wikitext);
            setLoaded({
              wikitext: res.data.wikitext,
              ...revisionOf(res.data.revisionRef ?? null, res.data.revisionRefs),
            });
          }
        } else {
          void utils.wikios.getWikitext.invalidate({ title });
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
    [title, saveWikitext, refetchWikitext, utils, onSaveSuccess, onClose]
  );

  const handleVisualSave = useCallback(
    (content: string, summary: string, minor: boolean, keepEditing?: boolean) =>
      performSave(
        { wikitext: lastSerializedRef.current?.wikitext || content, summary, minor, keepEditing },
        loaded?.revisionRef ?? null
      ),
    [performSave, loaded]
  );

  const handleSourceSave = useCallback(
    (wikitext: string, summary: string, minor: boolean, keepEditing?: boolean) =>
      performSave({ wikitext, summary, minor, keepEditing }, loaded?.revisionRef ?? null),
    [performSave, loaded]
  );

  // "Load current version": the author's text is kept as a draft, the editor starts over on the page as it is now.
  const handleLoadCurrent = useCallback(() => {
    if (!conflict) return;
    if (pendingSave.current) {
      saveDraft({ title, source: "ixwiki", mode, wikitext: pendingSave.current.wikitext });
    }
    pendingSave.current = null;
    setActiveWikitext(conflict.currentWikitext);
    setLoaded({ wikitext: conflict.currentWikitext, ...revisionOf(conflict.currentRevisionRef) });
    setConflict(null);
    setEditorKey((key) => key + 1);
  }, [conflict, mode, title]);

  // "Save anyway": the same save, on top of the version that is there now.
  const handleSaveAnyway = useCallback(async () => {
    const pending = pendingSave.current;
    if (!conflict || !pending) return;
    try {
      await performSave(pending, conflict.currentRevisionRef);
      notify.success("Article Published", "Your changes have been published over the newer version.");
    } catch {
      notify.error("Save Failed", "Could not save article changes.");
    }
  }, [conflict, performSave, notify]);

  if (staleDraft) {
    return (
      <div className="wikios-edit-bridge relative min-h-[600px] w-full">
        <div
          role="alert"
          className="mb-4 rounded-xl border border-border bg-card/75 p-4 text-sm text-foreground"
        >
          <p>
            <strong>Older draft found:</strong> this page changed after you saved your local draft.
            Restoring it will replace the current text in the editor; saving will then ask you to
            confirm, because it is based on an older version.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={handleRestoreStaleDraft}>
              Restore my draft
            </Button>
            <Button size="sm" onClick={handleDiscardStaleDraft}>
              Use current version
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Editors mount only once the draft question is settled: they restore drafts on their own.
  if (loaded === null || !draftResolved) {
    return <EditorLoading text="Loading article..." />;
  }

  const initialWikitextValue = activeWikitext ?? loaded.wikitext;

  return (
    <div className="wikios-edit-bridge relative min-h-[600px] w-full">
      {conflict && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-foreground"
        >
          <p>
            <strong>Edit Conflict Detected:</strong> someone else saved this page after you opened
            it. Your text is still in the editor and nothing was saved.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={handleLoadCurrent}>
              Load current version
            </Button>
            <Button size="sm" variant="destructive" onClick={() => void handleSaveAnyway()}>
              Save anyway
            </Button>
          </div>
        </div>
      )}

      {mode === "visual" ? (
        <WikiVisualEditor
          key={editorKey}
          title={title}
          initialWikitext={initialWikitextValue}
          onSave={handleVisualSave}
          onCancel={onClose}
          onSwitchToSource={(dirty, content) => handleModeSwitch("source", dirty, content)}
          onSerializedWikitext={setLastSerialized}
        />
      ) : (
        <WikiSourceEditor
          key={editorKey}
          title={title}
          initialWikitext={initialWikitextValue}
          initialSection={initialSection}
          onSave={handleSourceSave}
          onCancel={onClose}
          onSwitchToVisual={(dirty, wt) => handleModeSwitch("visual", dirty, wt)}
        />
      )}
    </div>
  );
}
