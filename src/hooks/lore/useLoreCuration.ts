"use client";

import { useState } from "react";
import type { LoreType } from "~/lib/lore/lore-types";
import { refusalMessage } from "~/lib/lore/writer-messages";
import { api } from "~/trpc/react";

export const CURATION_FAILED = "That could not be changed just now.";
export const ADD_EXISTING_FAILED = "That page could not be added just now.";

/**
 * The owner's curation of the Lore tab's pieces (`countryLore.setCuration`): pin, unpin and hide, each refreshing the
 * list. A refusal is kept against the piece it was for, in the server's words when the owner can act on it.
 */
export function useLoreCuration(countryId: string) {
  const utils = api.useUtils();
  const mutation = api.countryLore.setCuration.useMutation();
  const [refusal, setRefusal] = useState<{ title: string; message: string } | null>(null);

  const curate = async (title: string, change: { pinned?: boolean; hidden?: boolean }) => {
    setRefusal(null);
    try {
      await mutation.mutateAsync({ countryId, title, ...change });
      await utils.countryLore.list.invalidate({ countryId });
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      setRefusal({ title, message: refusalMessage(failure, CURATION_FAILED) });
    }
  };

  return {
    refusalFor: (title: string) => (refusal?.title === title ? refusal.message : null),
    busyTitle: mutation.isPending ? (mutation.variables?.title ?? null) : null,
    setPinned: (title: string, pinned: boolean) => curate(title, { pinned }),
    hide: (title: string) => curate(title, { hidden: true }),
  };
}

/** The owner adds an existing wiki page to the Lore tab (`countryLore.addExisting`); true when it was added. */
export function useAddExistingPiece(countryId: string) {
  const utils = api.useUtils();
  const mutation = api.countryLore.addExisting.useMutation();
  const [refusal, setRefusal] = useState<string | null>(null);

  const add = async (title: string, type: LoreType): Promise<boolean> => {
    setRefusal(null);
    try {
      await mutation.mutateAsync({ countryId, title, type });
      await utils.countryLore.list.invalidate({ countryId });
      return true;
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      setRefusal(refusalMessage(failure, ADD_EXISTING_FAILED));
      return false;
    }
  };

  return { add, refusal, clearRefusal: () => setRefusal(null), isPending: mutation.isPending };
}
