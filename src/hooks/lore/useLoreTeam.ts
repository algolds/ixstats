"use client";

import { useState } from "react";
import { refusalMessage } from "~/lib/lore/writer-messages";
import { api } from "~/trpc/react";

export const TEAM_FAILED = "The lore team could not be changed just now.";

/**
 * The owner's lore team (`countryLore.team`, `addAuthor`, `removeAuthor`), asked for only while the viewer manages
 * it. Each change refreshes the team; a refusal is kept in the server's words when the owner can act on it.
 */
export function useLoreTeam(countryId: string) {
  const access = api.countryLore.access.useQuery({ countryId }).data;
  const manages = (access?.enabled ?? false) && (access?.isOwner ?? false);
  const utils = api.useUtils();
  const team = api.countryLore.team.useQuery({ countryId }, { enabled: manages });
  const add = api.countryLore.addAuthor.useMutation();
  const remove = api.countryLore.removeAuthor.useMutation();
  const [refusal, setRefusal] = useState<string | null>(null);

  const change = async (call: () => Promise<object>): Promise<boolean> => {
    setRefusal(null);
    try {
      await call();
      await utils.countryLore.team.invalidate({ countryId });
      return true;
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      setRefusal(refusalMessage(failure, TEAM_FAILED));
      return false;
    }
  };

  return {
    manages,
    members: team.data ?? [],
    isLoading: team.isLoading,
    failed: team.isError,
    refusal,
    isPending: add.isPending || remove.isPending,
    addAuthor: (handle: string) => change(() => add.mutateAsync({ countryId, handle })),
    removeAuthor: (userId: string) => change(() => remove.mutateAsync({ countryId, userId })),
  };
}
