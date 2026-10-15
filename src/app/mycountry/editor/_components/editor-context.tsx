"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { RouterOutputs } from "~/trpc/react";
import type { EditorSectionId } from "~/lib/mycountry/editor-fields";

export type EditorState = RouterOutputs["countries"]["getEditorState"];

export interface DirtySection {
  id: string;
  label: string;
}

interface EditorContextValue {
  countryId: string;
  /** Sections with changes nobody saved yet, in report order. */
  dirty: DirtySection[];
  reportDirty: (section: DirtySection, isDirty: boolean) => void;
  /** Sections whose save was refused because another tab changed the same fields. */
  conflicts: EditorSectionId[];
  markConflict: (section: EditorSectionId) => void;
  /** Folds a section's saved values into the page's copy; that section alone re-keys. */
  applySaved: (update: (state: EditorState) => EditorState) => void;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export function EditorProvider({
  countryId,
  conflicts,
  onConflict,
  onSaved,
  children,
}: {
  countryId: string;
  conflicts: EditorSectionId[];
  onConflict: (section: EditorSectionId) => void;
  onSaved: (update: (state: EditorState) => EditorState) => void;
  children: React.ReactNode;
}) {
  const [dirty, setDirty] = useState<DirtySection[]>([]);

  const reportDirty = useCallback((section: DirtySection, isDirty: boolean) => {
    setDirty((current) => {
      const has = current.some((s) => s.id === section.id);
      if (isDirty === has) return current;
      return isDirty ? [...current, section] : current.filter((s) => s.id !== section.id);
    });
  }, []);

  const value = useMemo<EditorContextValue>(
    () => ({
      countryId,
      dirty,
      reportDirty,
      conflicts,
      markConflict: onConflict,
      applySaved: onSaved,
    }),
    [countryId, dirty, reportDirty, conflicts, onConflict, onSaved]
  );

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

export function useEditor(): EditorContextValue {
  const value = useContext(EditorContext);
  if (!value) throw new Error("useEditor must be used inside EditorProvider");
  return value;
}

/** Reports a section's unsaved state to the leave guard while it is mounted. */
export function useReportDirty(id: string, label: string, isDirty: boolean) {
  const { reportDirty } = useEditor();
  useEffect(() => {
    reportDirty({ id, label }, isDirty);
  }, [id, label, isDirty, reportDirty]);
  useEffect(() => () => reportDirty({ id, label }, false), [id, label, reportDirty]);
}
