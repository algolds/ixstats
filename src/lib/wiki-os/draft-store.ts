// src/lib/wiki-os/draft-store.ts
// Client-side autosave & draft persistence for WikiOS Canvas editor and Halo Wiki workspace.
// Supports canonical structured storage with full fallback for legacy storage keys.

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
const LEGACY_HTML_PREFIX = "wikios-draft-html-";
const LEGACY_SOURCE_PREFIX = "wikios-draft-";

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

    // Mirror to legacy keys for compatibility
    if (draft.mode === "visual" && draft.html) {
      window.localStorage.setItem(`${LEGACY_HTML_PREFIX}${draft.title}`, draft.html);
    } else if (draft.mode === "source" && draft.wikitext) {
      window.localStorage.setItem(`${LEGACY_SOURCE_PREFIX}${draft.title}`, draft.wikitext);
    }
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
    // 1. Try canonical structured draft
    const key = draftKey(title, source);
    const raw = window.localStorage.getItem(key);
    if (raw) {
      return JSON.parse(raw) as WikiEditorDraft;
    }

    // 2. Fallback to legacy visual draft
    const legacyHtml = window.localStorage.getItem(`${LEGACY_HTML_PREFIX}${title}`);
    if (legacyHtml) {
      return {
        title,
        source,
        html: legacyHtml,
        mode: "visual",
        savedAt: Date.now(),
      };
    }

    // 3. Fallback to legacy source draft
    const legacyWikitext = window.localStorage.getItem(`${LEGACY_SOURCE_PREFIX}${title}`);
    if (legacyWikitext) {
      return {
        title,
        source,
        wikitext: legacyWikitext,
        mode: "source",
        savedAt: Date.now(),
      };
    }

    return null;
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
    window.localStorage.removeItem(`${LEGACY_HTML_PREFIX}${title}`);
    window.localStorage.removeItem(`${LEGACY_SOURCE_PREFIX}${title}`);
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
 * List all saved drafts across all pages, deduplicated by normalized title.
 */
export function listDrafts(): WikiEditorDraft[] {
  if (typeof window === "undefined") return [];
  const draftsMap = new Map<string, WikiEditorDraft>();

  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key) continue;

      // 1. Canonical structured drafts
      if (key.startsWith(STORAGE_PREFIX)) {
        const raw = window.localStorage.getItem(key);
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as WikiEditorDraft;
            const norm = parsed.title.replace(/ /g, "_");
            draftsMap.set(norm, parsed);
          } catch {
            /* invalid JSON */
          }
        }
      }
      // 2. Legacy visual drafts
      else if (key.startsWith(LEGACY_HTML_PREFIX)) {
        const title = key.substring(LEGACY_HTML_PREFIX.length);
        const norm = title.replace(/ /g, "_");
        if (!draftsMap.has(norm)) {
          const html = window.localStorage.getItem(key);
          if (html) {
            draftsMap.set(norm, {
              title,
              source: "ixwiki",
              html,
              mode: "visual",
              savedAt: Date.now(),
            });
          }
        }
      }
      // 3. Legacy source drafts
      else if (key.startsWith(LEGACY_SOURCE_PREFIX) && !key.startsWith(LEGACY_HTML_PREFIX)) {
        const title = key.substring(LEGACY_SOURCE_PREFIX.length);
        const norm = title.replace(/ /g, "_");
        if (!draftsMap.has(norm)) {
          const wikitext = window.localStorage.getItem(key);
          if (wikitext) {
            draftsMap.set(norm, {
              title,
              source: "ixwiki",
              wikitext,
              mode: "source",
              savedAt: Date.now(),
            });
          }
        }
      }
    }
  } catch {
    /* ignore */
  }

  return Array.from(draftsMap.values()).sort((a, b) => b.savedAt - a.savedAt);
}
