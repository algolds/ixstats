import { useState } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import {
  NO_PREFERENCES,
  withPreference,
  type ConversationPreferences,
  type PreferenceField,
} from "~/lib/messages/preferences";
import { DEFAULT_MESSAGES_SETTINGS, type MessagesSettings } from "./MessagesFolderNav";

const SETTINGS_KEY = "ixstats:messages:settings";

function readSettings(): Partial<MessagesSettings> {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    return stored ? (JSON.parse(stored) as Partial<MessagesSettings>) : {};
  } catch {
    return {};
  }
}

function writeSettings(value: MessagesSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(value));
  } catch {
    // storage unavailable (private mode): the setting is not persisted
  }
}

/** The muted and archived lists of the signed-in person, kept on the server so every device agrees. */
function useConversationPreferenceLists() {
  const utils = api.useUtils();
  const notify = useNotify();
  const { data } = api.messages.getConversationPreferences.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const prefs: ConversationPreferences = data ?? NO_PREFERENCES;

  const mutation = api.messages.setConversationPreferences.useMutation({
    // The row flips at once; a refused change puts the server's lists back.
    onMutate: async (input) => {
      await utils.messages.getConversationPreferences.cancel();
      const previous = utils.messages.getConversationPreferences.getData();
      utils.messages.getConversationPreferences.setData(undefined, (old) => {
        let next = old ?? NO_PREFERENCES;
        if (input.muted !== undefined) {
          next = withPreference(next, "muted", input.conversationId, input.muted);
        }
        if (input.archived !== undefined) {
          next = withPreference(next, "archived", input.conversationId, input.archived);
        }
        return next;
      });
      return { previous };
    },
    onError: (error, _input, context) => {
      utils.messages.getConversationPreferences.setData(undefined, context?.previous);
      notify.error(error.message || "Could not save that change");
    },
    onSettled: () => void utils.messages.getConversationPreferences.invalidate(),
  });

  const listFor = (field: PreferenceField) => {
    const set = (conversationId: string, on: boolean) =>
      mutation.mutate({ conversationId, [field]: on });
    return {
      ids: prefs[field],
      toggle: (conversationId: string) =>
        set(conversationId, !prefs[field].includes(conversationId)),
      remove: (conversationId: string) => {
        if (prefs[field].includes(conversationId)) set(conversationId, false);
      },
    };
  };

  return { muted: listFor("muted"), archived: listFor("archived") };
}

/** Local display settings (sounds, name style) plus the server-side muted and archived conversation lists. */
export function useMessagePreferences() {
  const [settings, setSettings] = useState<MessagesSettings>(() => ({
    ...DEFAULT_MESSAGES_SETTINGS,
    ...readSettings(),
  }));
  const { muted, archived } = useConversationPreferenceLists();

  const updateSettings = (next: MessagesSettings) => {
    setSettings(next);
    writeSettings(next);
  };

  return { settings, updateSettings, muted, archived };
}
