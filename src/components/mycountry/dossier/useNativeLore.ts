import { useState } from "react";
import type { ParsedLoreSection } from "./dossier/FileImportDropzone";

export interface LoreDoc {
  id: string;
  title: string;
  content: string;
  clearance: "PUBLIC" | "ALLIANCE" | "PRIVATE";
  updatedAt: string;
}

export type LoreDraft = Pick<LoreDoc, "title" | "content" | "clearance">;

/** A nation's native lore documents, persisted in this browser (ready for DB sync). */
export function useNativeLore(countryName: string) {
  const storageKey = `ixstats_native_lore_${countryName}`;
  const [docs, setDocs] = useState<LoreDoc[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? (JSON.parse(saved) as LoreDoc[]) : [];
    } catch {
      return [];
    }
  });

  const save = (next: LoreDoc[]) => {
    setDocs(next);
    if (typeof window !== "undefined") localStorage.setItem(storageKey, JSON.stringify(next));
  };

  return {
    docs,
    /** Updates the document with `id`, or adds a new one at the top. */
    saveDoc: (draft: LoreDraft, id?: string) => {
      const updatedAt = new Date().toISOString();
      save(
        id
          ? docs.map((d) => (d.id === id ? { ...d, ...draft, updatedAt } : d))
          : [{ id: `lore_${Date.now()}`, ...draft, updatedAt }, ...docs]
      );
    },
    importSections: (sections: ParsedLoreSection[]) => {
      const imported = sections.map((s, idx) => ({
        id: `lore_imported_${Date.now()}_${idx}`,
        title: s.title,
        content: s.content,
        clearance: s.classification,
        updatedAt: new Date().toISOString(),
      }));
      save([...imported, ...docs]);
    },
    deleteDoc: (id: string) => save(docs.filter((d) => d.id !== id)),
  };
}
