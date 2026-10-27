"use client";

import { useState } from "react";
import type { LoreType } from "~/lib/lore/lore-types";
import { refusalMessage } from "~/lib/lore/writer-messages";
import { api } from "~/trpc/react";

export const CURATION_FAILED = "That could not be changed just now.";
export const ADD_EXISTING_FAILED = "That page could not be added just now.";

const without = <T>(map: ReadonlyMap<string, T>, title: string): ReadonlyMap<string, T> => {
  const next = new Map(map);
  next.delete(title);
  return next;
};

/**
 * The owner's curation of the Lore tab's pieces (`countryLore.setCuration`): pin, unpin and hide, each refreshing the
 * list. Each piece keeps its own state: whether a change to it is in flight, and its last refusal, in the server's
 * words when the owner can act on it. A change to one piece never frees or clears another.
 */
export function useLoreCuration(countryId: string) {
  const utils = api.useUtils();
  const mutation = api.countryLore.setCuration.useMutation();
  const [pending, setPending] = useState<ReadonlyMap<string, true>>(new Map());
  const [refusals, setRefusals] = useState<ReadonlyMap<string, string>>(new Map());

  const curate = async (title: string, change: { pinned?: boolean; hidden?: boolean }) => {
    setRefusals((current) => without(current, title));
    setPending((current) => new Map(current).set(title, true));
    try {
      await mutation.mutateAsync({ countryId, title, ...change });
      await utils.countryLore.list.invalidate({ countryId });
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      const message = refusalMessage(failure, CURATION_FAILED);
      setRefusals((current) => new Map(current).set(title, message));
    } finally {
      setPending((current) => without(current, title));
    }
  };

  return {
    refusalFor: (title: string) => refusals.get(title) ?? null,
    isBusy: (title: string) => pending.has(title),
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
