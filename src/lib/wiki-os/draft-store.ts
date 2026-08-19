// src/lib/wiki-os/draft-store.ts
// Client-side autosave & draft persistence for WikiOS Canvas editor.
// Stores in-progress edits in localStorage/IndexedDB to prevent data loss.

export interface WikiEditorDraft {
  readonly title: string;
  readonly source: string;
  readonly wikitext?: string;
  readonly html?: string;
  readonly mode: "visual" | "source";
  readonly basetimestamp?: string;
  readonly savedAt: number;
}

const STORAGE_PREFIX = "wikios_draft:";

function draftKey(title: string, source = "ixwiki"): string {
  return `${STORAGE_PREFIX}${source}:${title.replace(/ /g, "_")}`;
}

/**
 * Save an in-progress editor draft to client storage.
 */
export function saveDraft(draft: Omit<WikiEditorDraft, "savedAt">): void {
  if (typeof window === "undefined") return;
  try {
    const key = draftKey(draft.title, draft.source);
    const payload: WikiEditorDraft = {
      ...draft,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch (err) {
    console.warn("[WikiDraftStore] Failed to save draft:", err);
  }
}

/**
 * Retrieve an existing draft for a page, if present.
 */
export function getDraft(title: string, source = "ixwiki"): WikiEditorDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const key = draftKey(title, source);
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as WikiEditorDraft;
  } catch {
    return null;
  }
}

/**
 * Delete a draft after successful publication or explicit discard.
 */
export function clearDraft(title: string, source = "ixwiki"): void {
  if (typeof window === "undefined") return;
  try {
    const key = draftKey(title, source);
    window.localStorage.removeItem(key);
  } catch {
    /* best-effort */
  }
}

/**
 * Check if an active draft exists for a page.
 */
export function hasDraft(title: string, source = "ixwiki"): boolean {
  return getDraft(title, source) !== null;
}

/**
 * List all saved drafts across all pages.
 */
export function listDrafts(): WikiEditorDraft[] {
  if (typeof window === "undefined") return [];
  const drafts: WikiEditorDraft[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        const raw = window.localStorage.getItem(key);
        if (raw) {
          try {
            drafts.push(JSON.parse(raw) as WikiEditorDraft);
          } catch {
            /* invalid JSON */
          }
        }
      }
    }
  } catch {
    /* ignore */
  }
  return drafts.sort((a, b) => b.savedAt - a.savedAt);
}
