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
  /** The author's text when they chose "Load current version": kept here, not in the draft store. */
  const [setAsideText, setSetAsideText] = useState<string | null>(null);
  /** The author put their set-aside text back: saving now replaces the current version with it. */
  const [restoredOverCurrent, setRestoredOverCurrent] = useState(false);
  const pendingSave = useRef<PendingSave | null>(null);
  /** Reads the mounted editor's content as it is now (see the editors' `registerContentReader`). */
  const readContentRef = useRef<(() => string | null) | null>(null);
  const registerContentReader = useCallback((read: (() => string | null) | null) => {
    readContentRef.current = read;
  }, []);

  // Single Authoritative Fetch via getWikitext (read-through Postgres + MediaWiki fallback)
  // An editor starts from the page as it is now, never from a cached copy: the text it opens and the
  // revision its save is checked against must be as fresh as the open itself.
  const {
    data: wikitextData,
    isLoading: wtLoading,
    isFetchedAfterMount,
    refetch: refetchWikitext,
  } = api.wikios.getWikitext.useQuery(
    { title },
    { staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: false }
  );

  const saveWikitext = api.wikios.saveWikitext.useMutation();

  if (loaded === null && !wtLoading && isFetchedAfterMount) {
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
        setSetAsideText(null);
        setRestoredOverCurrent(false);
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
        // The serialized wikitext is the content, empty or not; `content` is only the editor's own report.
        { wikitext: lastSerializedRef.current ? lastSerializedRef.current.wikitext : content, summary, minor, keepEditing },
        loaded?.revisionRef ?? null
      ),
    [performSave, loaded]
  );

  const handleSourceSave = useCallback(
    (wikitext: string, summary: string, minor: boolean, keepEditing?: boolean) =>
      performSave({ wikitext, summary, minor, keepEditing }, loaded?.revisionRef ?? null),
    [performSave, loaded]
  );

  // "Load current version": the editor starts over on the page as it is now. Any local draft of the
  // page is cleared first (an editor starts from a draft it finds), and the author's text is kept
  // here, in this component, for "Restore my text" / "Copy my version".
  const handleLoadCurrent = useCallback(() => {
    if (!conflict) return;
    const mine = readContentRef.current?.() ?? pendingSave.current?.wikitext ?? null;
    clearDraft(title);
    setSetAsideText(mine);
    setRestoredOverCurrent(false);
    pendingSave.current = null;
    setActiveWikitext(conflict.currentWikitext);
    setLoaded({ wikitext: conflict.currentWikitext, ...revisionOf(conflict.currentRevisionRef) });
    setConflict(null);
    setEditorKey((key) => key + 1);
  }, [conflict, title]);

  const handleRestoreMyText = useCallback(() => {
    if (setAsideText === null) return;
    setActiveWikitext(setAsideText);
    setSetAsideText(null);
    setRestoredOverCurrent(true);
    setEditorKey((key) => key + 1);
  }, [setAsideText]);

  const handleCopyMyText = useCallback(() => {
    if (setAsideText === null) return;
    navigator.clipboard.writeText(setAsideText).then(
      () => notify.success("Copied", "Your version is on the clipboard."),
      () => notify.error("Copy Failed", "Could not copy your version; restore it into the editor instead.")
    );
  }, [setAsideText, notify]);

  // "Save anyway": what is in the editor NOW, on top of the version that is there now. The editor may
  // have changed since the save that conflicted, and its content is what the author means to publish.
  const handleSaveAnyway = useCallback(async () => {
    const pending = pendingSave.current;
    if (!conflict || !pending) return;
    const current = readContentRef.current ? readContentRef.current() : pending.wikitext;
    if (current === null) {
      notify.error("Save Blocked", "Some content could not be converted to wikitext; switch to source mode to fix it.");
      return;
    }
    try {
      await performSave({ ...pending, wikitext: current }, conflict.currentRevisionRef);
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

      {restoredOverCurrent && !conflict && (
        <p role="status" className="mb-4 rounded-xl border border-border bg-card/75 px-4 py-2 text-sm text-foreground">
          <strong>This is your text, not the current version:</strong> saving will replace the current version with it.
        </p>
      )}

      {setAsideText !== null && !conflict && (
        <div role="status" className="mb-4 rounded-xl border border-border bg-card/75 p-4 text-sm text-foreground">
          <p>
            <strong>Your version was set aside.</strong> The editor now shows the page as it is
            published. Your unsaved text is kept until you save or close this editor.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={handleRestoreMyText}>
              Restore my text
            </Button>
            <Button size="sm" variant="outline" onClick={handleCopyMyText}>
              Copy my version
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSetAsideText(null)}>
              Dismiss
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
          registerContentReader={registerContentReader}
          restoreLocalDraft={false}
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
          registerContentReader={registerContentReader}
        />
      )}
    </div>
  );
}
