"use client";

import { api } from "~/trpc/react";
import type { EmojiList } from "./ReactionGlyph";

const EMOJI_STALE_MS = 5 * 60_000;

/** The Discord emoji list the reaction glyphs resolve names against; loaded only when `enabled`. */
export function useReactionEmojis(enabled = true): EmojiList | undefined {
  const { data } = api.thinkpages.getDiscordEmojis.useQuery(
    {},
    { enabled, staleTime: EMOJI_STALE_MS, retry: 1, refetchOnWindowFocus: false }
  );
  return data?.emojis;
}
