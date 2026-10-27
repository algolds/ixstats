import { useCallback, useState } from "react";
import { DEFAULT_MESSAGES_SETTINGS, type MessagesSettings } from "./MessagesFolderNav";

const SETTINGS_KEY = "ixstats:messages:settings";
const MUTED_KEY = "ixstats:messages:muted";
const ARCHIVED_KEY = "ixstats:messages:archived";

function readStored<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable (private mode): the preference is not persisted
  }
}

function useStoredIdList(key: string) {
  const [ids, setIds] = useState<string[]>(() => readStored(key, []));

  const toggle = useCallback(
    (id: string) =>
      setIds((prev) => {
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
        writeStored(key, next);
        return next;
      }),
    [key]
  );
  const remove = useCallback(
    (id: string) =>
      setIds((prev) => {
        const next = prev.filter((x) => x !== id);
        writeStored(key, next);
        return next;
      }),
    [key]
  );

  return { ids, toggle, remove };
}

/** localStorage-backed display settings plus the muted and archived conversation lists. */
export function useMessagePreferences() {
  const [settings, setSettings] = useState<MessagesSettings>(() => ({
    ...DEFAULT_MESSAGES_SETTINGS,
    ...readStored<Partial<MessagesSettings>>(SETTINGS_KEY, {}),
  }));
  const muted = useStoredIdList(MUTED_KEY);
  const archived = useStoredIdList(ARCHIVED_KEY);

  const updateSettings = useCallback((next: MessagesSettings) => {
    setSettings(next);
    writeStored(SETTINGS_KEY, next);
  }, []);

  return { settings, updateSettings, muted, archived };
}
