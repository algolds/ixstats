import "server-only";

import { TRPCError } from "@trpc/server";
import { cache } from "react";
import { api } from "~/trpc/server";

/**
 * Whether the wiki user `username` exists: true or false, or null when it could not be told (the
 * lookup is rate limited and the answer is "busy", not "no such user"). Cached per request, as the
 * page and its metadata both ask.
 */
export const userExists = cache(async (username: string): Promise<boolean | null> => {
  try {
    return (await api.users.resolveWikiAuthor({ wikiUsername: username })) !== null;
  } catch (error) {
    if (error instanceof TRPCError) {
      if (error.code === "BAD_REQUEST") return false; // too long to be a user name
      if (error.code === "TOO_MANY_REQUESTS") return null;
    }
    throw error;
  }
});
