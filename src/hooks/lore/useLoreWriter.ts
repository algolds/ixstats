import { useRef, useState } from "react";
import {
  lorePrefill,
  seedLoreFields,
  type LoreFieldSeed,
  type LoreFields,
} from "~/components/country-profile/lore/writer/lore-prefill";
import type { WikitextSerializeResult } from "~/components/wiki-os/editor/plate/wiki-wikitext";
import type { LoreType } from "~/lib/lore/lore-types";
import { loreWordCount } from "~/lib/lore/word-count";
import {
  isMissingCategoryRefusal,
  recordFailureMessage,
  saveRefusalMessage,
} from "~/lib/lore/writer-messages";
import { clearDraft, saveDraft } from "~/lib/wiki-os/editor/draft-store";
import { useWikiAuth } from "~/lib/wiki-os/use-wiki-auth";
import { api } from "~/trpc/react";

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

type ContentReader = (() => string | null) | null;

interface LoreWriterOptions {
  countryId: string;
  countryName: string;
  seed?: LoreWriterSeed;
  editTitle?: string;
  onClose: () => void;
}

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
 * The lore writer's state (docs/superpowers/specs/2026-10-24-native-lore-design.md, "Writing flow"): type, details,
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
  const calls = useLoreCalls(countryId);
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
  const [words, setWords] = useState(0);
  const readerRef = useRef<ContentReader>(null);
  /** The editor's text as it opened (its first serialization), to tell an edit from none. */
  const openedRef = useRef<string | null>(null);
  const savedRef = useRef(false);

  /** The editor's text when the author changed it (or always, with `always`), else null. */
  const editorText = (always: boolean): string | null => {
    const text = readerRef.current?.() ?? null;
    if (text === null || (!always && text === (openedRef.current ?? target?.prefill))) return null;
    return text;
  };

  const keepAsDraft = (pageTitle: string, text: string) =>
    saveDraft(userId, { title: pageTitle, source: "ixwiki", mode: "visual", wikitext: text });

  const openEditor = (next: LoreEditorTarget) => {
    openedRef.current = null;
    savedRef.current = false;
    setSaveError(null);
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
    if (target && text !== null) keepAsDraft(target.title, text);
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
    words,
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
    handOverToWikiOS: () => {
      const text = target ? editorText(target.prefill !== undefined) : null;
      if (target && text !== null) keepAsDraft(target.title, text);
    },
    retryRecord: () => {
      if (target) void runRecord(target.title);
    },
    /** Reopen the saved page (to put its lore category back); its next save records it again. */
    editAgain: () => {
      if (target) openEditor({ title: target.title, records: true });
    },
    bridge: {
      onSerializedWikitext: (result: WikitextSerializeResult) => {
        openedRef.current ??= result.wikitext;
        setWords(loreWordCount(result.wikitext));
      },
      registerContentReader: (read: ContentReader) => {
        readerRef.current = read;
      },
      onSaveError: (error: Error) => setSaveError(saveRefusalMessage(error)),
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
