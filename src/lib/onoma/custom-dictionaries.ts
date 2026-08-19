// src/lib/onoma/custom-dictionaries.ts
// Client-side LocalStorage repository for user custom dictionaries

export interface CustomDictionary {
  id: string;
  title: string;
  values: string[];
  category?: string;
  isCustom: true;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "onoma_custom_dictionaries";
export const CUSTOM_DICTS_CHANGED_EVENT = "onoma_custom_dicts_changed";

/**
 * Load all user custom dictionaries from localStorage.
 */
export function loadCustomDictionaries(): CustomDictionary[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => ({
      ...item,
      isCustom: true as const,
      values: Array.isArray(item.values) ? item.values : [],
    }));
  } catch (err) {
    console.error("Failed to parse custom dictionaries from localStorage:", err);
    return [];
  }
}

/**
 * Save or update a custom dictionary in localStorage.
 */
export function saveCustomDictionary(
  title: string,
  values: string[],
  id?: string,
  category = "person"
): CustomDictionary {
  const current = loadCustomDictionaries();
  const now = Date.now();
  const cleanValues = Array.from(
    new Set(
      values
        .flatMap((v) => v.split(/[,\r\n]+/))
        .map((v) => v.trim())
        .filter(Boolean)
    )
  );

  let updatedDict: CustomDictionary;

  if (id && current.some((d) => d.id === id)) {
    // Update existing
    current.forEach((d, idx) => {
      if (d.id === id) {
        current[idx] = {
          ...d,
          title: title.trim() || d.title,
          values: cleanValues,
          updatedAt: now,
        };
        updatedDict = current[idx];
      }
    });
  } else {
    // Create new
    const newId = id || `custom-dict-${now}-${Math.random().toString(36).slice(2, 7)}`;
    updatedDict = {
      id: newId,
      title: title.trim() || "Untitled Lexicon",
      values: cleanValues,
      category,
      isCustom: true,
      createdAt: now,
      updatedAt: now,
    };
    current.unshift(updatedDict);
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(CUSTOM_DICTS_CHANGED_EVENT));
    }
  } catch (err) {
    console.error("Failed to save custom dictionary:", err);
  }

  return updatedDict!;
}

/**
 * Rename an existing custom dictionary.
 */
export function renameCustomDictionary(id: string, newTitle: string): boolean {
  if (!id || !newTitle.trim()) return false;
  const current = loadCustomDictionaries();
  let found = false;
  const updated = current.map((d) => {
    if (d.id === id) {
      found = true;
      return { ...d, title: newTitle.trim(), updatedAt: Date.now() };
    }
    return d;
  });

  if (found) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(CUSTOM_DICTS_CHANGED_EVENT));
      }
    } catch (err) {
      console.error("Failed to rename custom dictionary:", err);
      return false;
    }
  }
  return found;
}

/**
 * Delete a custom dictionary by ID.
 */
export function deleteCustomDictionary(id: string): boolean {
  if (!id) return false;
  const current = loadCustomDictionaries();
  const filtered = current.filter((d) => d.id !== id);
  if (filtered.length !== current.length) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(CUSTOM_DICTS_CHANGED_EVENT));
      }
      return true;
    } catch (err) {
      console.error("Failed to delete custom dictionary:", err);
      return false;
    }
  }
  return false;
}
