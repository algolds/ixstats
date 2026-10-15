"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export interface DirtySection {
  id: string;
  label: string;
}

interface EditorContextValue {
  countryId: string;
  /** The `Country.updatedAt` every save is checked against; each save moves it on. */
  getVersion: () => Date;
  setVersion: (version: Date) => void;
  /** Sections with changes nobody saved yet, in report order. */
  dirty: DirtySection[];
  reportDirty: (section: DirtySection, isDirty: boolean) => void;
  /** Another tab or the server changed the nation: saves stop until the page reloads its data. */
  stale: boolean;
  markStale: () => void;
  /**
   * A save is on its way. Saves go one at a time: each moves the version on, so a second save
   * sent with the old version would be refused as stale.
   */
  saving: boolean;
  beginSave: () => void;
  endSave: () => void;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export function EditorProvider({
  countryId,
  version,
  stale,
  onStale,
  children,
}: {
  countryId: string;
  version: Date;
  stale: boolean;
  onStale: () => void;
  children: React.ReactNode;
}) {
  const versionRef = useRef(version);
  const [dirty, setDirty] = useState<DirtySection[]>([]);
  const [saving, setSaving] = useState(0);
  const beginSave = useCallback(() => setSaving((n) => n + 1), []);
  const endSave = useCallback(() => setSaving((n) => Math.max(0, n - 1)), []);

  // A reload hands down a fresh version; adopt it.
  useEffect(() => {
    versionRef.current = version;
  }, [version]);

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
      getVersion: () => versionRef.current,
      setVersion: (next) => {
        versionRef.current = next;
      },
      dirty,
      reportDirty,
      stale,
      markStale: onStale,
      saving: saving > 0,
      beginSave,
      endSave,
    }),
    [countryId, dirty, reportDirty, stale, onStale, saving, beginSave, endSave]
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
