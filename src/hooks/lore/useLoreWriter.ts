import { useRef, useState } from "react";
import {
  lorePrefill,
  seedLoreFields,
  type LoreFieldSeed,
  type LoreFields,
} from "~/lib/lore/lore-prefill";
import { useNotify } from "~/hooks/useNotify";
import type { LoreType } from "~/lib/lore/lore-types";
import {
  isMissingCategoryRefusal,
  recordFailureMessage,
  saveRefusalMessage,
} from "~/lib/lore/writer-messages";
import {
  clearDraft,
  getDraft,
  saveDraft,
  type WikiEditorDraft,
} from "~/lib/wiki-os/editor/draft-store";
import { useWikiAuth } from "~/lib/wiki-os/use-wiki-auth";
import { api } from "~/trpc/react";
import { useLoreEditorText } from "./useLoreEditorText";

export interface LoreWriterSeed extends LoreFieldSeed {
  type?: LoreType;
  title?: string;
}

export type LorePhase = "type" | "details" | "editor" | "saved";

/** The page the editor is open on. */
export interface LoreEditorTarget {
  title: string;
  /** The starting text of a new piece; absent for a page that exists. */
  prefill?: string;
  /** Its save records the piece on the Lore tab (a new piece, or one reopened after a refused record). */
  records: boolean;
}

export type LoreRecordState =
  { status: "pending" } | { status: "failed"; message: string; missingCategory: boolean };

interface LoreWriterOptions {
  countryId: string;
  countryName: string;
  seed?: LoreWriterSeed;
  editTitle?: string;
  onClose: () => void;
}

/** WikiOS's editor opens on a draft of the title (as the bridge restores one) instead of `prefill`. */
const opensOnDraft = (draft: WikiEditorDraft | null, prefill: string) =>
  draft !== null && Boolean(draft.wikitext || draft.html) && draft.wikitext !== prefill;

function openingPhase(seed: LoreWriterSeed | undefined, editTitle: string | undefined): LorePhase {
  if (editTitle) return "editor";
  return seed?.type ? "details" : "type";
}

/** The Lore tab's record and curation calls the writer makes; each refreshes the list. */
function useLoreCalls(countryId: string) {
  const utils = api.useUtils();
  const record = api.countryLore.recordPiece.useMutation();
  const addExisting = api.countryLore.addExisting.useMutation();
  const refreshList = () => void utils.countryLore.list.invalidate({ countryId });
  return {
    refreshList,
    recordPiece: async (title: string, type: LoreType) => {
      await record.mutateAsync({ countryId, title, type });
      refreshList();
    },
    addExisting: async (title: string, type: LoreType) => {
      await addExisting.mutateAsync({ countryId, title, type });
      refreshList();
    },
  };
}

/**
 * The lore writer's state (docs/specs/2026-10-24-native-lore-design.md, "Writing flow"): type, details,
 * the editor, then the Lore tab record. The author's text is never dropped: going back carries it (and keeps it as
 * their draft), closing keeps it as their draft, and "Open in WikiOS" hands it over as their draft, never in a URL.
 */
export function useLoreWriter({
  countryId,
  countryName,
  seed,
  editTitle,
  onClose,
}: LoreWriterOptions) {
  const { user } = useWikiAuth();
  const userId = user?.id ?? null;
  const notify = useNotify();
  const calls = useLoreCalls(countryId);
  const editor = useLoreEditorText();
  const [phase, setPhase] = useState<LorePhase>(() => openingPhase(seed, editTitle));
  const [type, setType] = useState<LoreType | null>(seed?.type ?? null);
  const [title, setTitle] = useState(seed?.title ?? "");
  const [fields, setFields] = useState<LoreFields>(() => seedLoreFields(seed));
  const [carried, setCarried] = useState<{ text: string; from: string } | null>(null);
  const [target, setTarget] = useState<LoreEditorTarget | null>(() =>
    editTitle ? { title: editTitle, records: false } : null
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [record, setRecord] = useState<LoreRecordState | null>(null);
  /** The editor opened on the author's earlier draft of the title, not the form's text. */
  const [restoredDraft, setRestoredDraft] = useState(false);
  /** Changes when the editor must open again from scratch (the draft was discarded). */
  const [editorKey, setEditorKey] = useState(0);
  /** The author's text, when the browser refused to keep it as a draft on the way out. */
  const [unkept, setUnkept] = useState<{ text: string; leaving: "close" | "wikios" } | null>(null);
  const savedRef = useRef(false);

  /** The editor's text when the author changed it (or always, with `always`), else null. */
  const editorText = (always: boolean) => editor.read(target?.prefill, always);

  const keepAsDraft = (pageTitle: string, text: string) =>
    saveDraft(userId, { title: pageTitle, source: "ixwiki", mode: "visual", wikitext: text });

  const openEditor = (next: LoreEditorTarget) => {
    editor.reset();
    savedRef.current = false;
    setSaveError(null);
    setRestoredDraft(
      next.prefill !== undefined && opensOnDraft(getDraft(userId, next.title), next.prefill)
    );
    setTarget(next);
    setPhase("editor");
  };

  const runRecord = async (pageTitle: string) => {
    setRecord({ status: "pending" });
    try {
      await calls.recordPiece(pageTitle, type ?? "other");
      onClose();
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      setRecord({
        status: "failed",
        message: recordFailureMessage(failure),
        missingCategory: isMissingCategoryRefusal(failure, countryName),
      });
    }
  };

  const requestClose = () => {
    // The editor's reader is gone once it closed, so only an open, unsaved editor's text is kept.
    const text = target && !savedRef.current ? editorText(false) : null;
    if (target && text !== null) {
      // A browser that refuses the draft (storage full or blocked) keeps the writer open instead.
      if (!keepAsDraft(target.title, text)) {
        setUnkept({ text, leaving: "close" });
        return;
      }
      notify.info(
        "Draft kept",
        `Your text is kept as a draft of ${target.title}. It opens again when you write under this title.`
      );
    }
    onClose();
  };

  return {
    phase,
    type,
    title,
    fields,
    carried: carried !== null,
    target,
    saveError,
    record,
    words: editor.words,
    // Gone once the author writes: discarding the draft would take their new text with it.
    restoredDraft: restoredDraft && !editor.edited,
    editorKey,
    unkept,
    setTitle,
    setFields,
    chooseType: (next: LoreType) => {
      setType(next);
      setPhase("details");
    },
    backToType: () => setPhase("type"),
    /** Open the editor on a free title: the author's kept text, else the type's starting text. */
    startWriting: (pageTitle: string) => {
      const prefill = carried?.text ?? lorePrefill(type ?? "other", pageTitle, fields, countryName);
      openEditor({ title: pageTitle, prefill, records: true });
    },
    backToDetails: () => {
      const text = target ? editorText(false) : null;
      if (target && text !== null) {
        keepAsDraft(target.title, text);
        setCarried({ text, from: target.title });
      }
      setPhase("details");
    },
    startAgain: () => {
      if (carried) clearDraft(userId, carried.from);
      setCarried(null);
    },
    /** Add an existing page to the Lore tab and close; the failure to show, or null. */
    addExisting: async (resolvedTitle: string): Promise<string | null> => {
      try {
        await calls.addExisting(resolvedTitle, type ?? "other");
      } catch (error) {
        return recordFailureMessage(error instanceof Error ? error : new Error(String(error)));
      }
      onClose();
      return null;
    },
    requestClose,
    /** "Open in WikiOS": a new page's text always goes over as the author's draft, an existing page's once edited. */
    handOverToWikiOS: (): boolean => {
      const text = target ? editorText(target.prefill !== undefined) : null;
      if (!target || text === null || keepAsDraft(target.title, text)) return true;
      setUnkept({ text, leaving: "wikios" });
      return false;
    },
    copyUnkept: () => {
      if (!unkept) return;
      navigator.clipboard.writeText(unkept.text).then(
        () => notify.success("Copied", "Your text is on the clipboard."),
        () => notify.error("Copy failed", "Select the text in the editor and copy it from there.")
      );
    },
    dismissUnkept: () => setUnkept(null),
    closeWithoutKeeping: onClose,
    /**
     * Discard the restored draft (the author confirmed) and open the editor again on the form's text; never once the
     * author has written in this editor (an editor that reports nothing is asked here).
     */
    discardDraft: () => {
      if (!target) return;
      setRestoredDraft(false);
      if (editorText(false) !== null) return;
      clearDraft(userId, target.title);
      editor.reset();
      setEditorKey((key) => key + 1);
    },
    retryRecord: () => {
      if (target) void runRecord(target.title);
    },
    /** Reopen the saved page (to put its lore category back); its next save records it again. */
    editAgain: () => {
      if (target) openEditor({ title: target.title, records: true });
    },
    bridge: {
      onSerializedWikitext: editor.onSerializedWikitext,
      registerContentReader: editor.registerContentReader,
      onModeChange: editor.onModeChange,
      onEditorOpened: editor.onEditorOpened,
      onSaveError: (error: Error) => setSaveError(saveRefusalMessage(error)),
      onSaveStart: () => setSaveError(null),
      onSaveSuccess: () => {
        savedRef.current = true;
        setSaveError(null);
        if (!target?.records) {
          calls.refreshList();
          return;
        }
        setPhase("saved");
        void runRecord(target.title);
      },
      /** The editor closes after a save (the record takes over), or on its own Cancel. */
      onClose: () => {
        if (!savedRef.current) requestClose();
        else if (!target?.records) onClose();
      },
    },
  };
}

export type LoreWriterFlow = ReturnType<typeof useLoreWriter>;
