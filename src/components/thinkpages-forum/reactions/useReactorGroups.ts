"use client";

import { api } from "~/trpc/react";
import { ALL_REACTIONS } from "./reactors-tabs";

/**
 * The reactor groups for a post. The read without a type lists only the twelve most reacted types, so a dialog opened
 * on a type outside them (the viewer's own pill) asks for that type too and appends its group.
 */
export function useReactorGroups(postId: string, type: string) {
  const base = api.thinkpagesForum.reactors.useQuery({ postId });
  const listed = base.data?.groups ?? [];
  const missing =
    type !== ALL_REACTIONS && base.data !== undefined && !listed.some((g) => g.type === type);
  const extra = api.thinkpagesForum.reactors.useQuery({ postId, type }, { enabled: missing });
  const added = missing
    ? (extra.data?.groups ?? []).filter((group) => group.reactors.length > 0)
    : [];
  return {
    groups: [...listed, ...added],
    isLoading: base.isLoading,
    isError: base.isError,
    refetch: base.refetch,
  };
}
