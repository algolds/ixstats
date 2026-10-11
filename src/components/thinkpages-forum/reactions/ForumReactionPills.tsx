"use client";

import {
  REACTOR_TYPES_MAX,
  reactionLabel,
  sortedReactionTypes,
  type ReactionCounts,
} from "~/lib/thinkpages-forum/reactions";
import { cn } from "~/lib/utils/cn";
import { ReactionGlyph, type EmojiList } from "./ReactionGlyph";
import { ALL_REACTIONS } from "./reactors-tabs";

const PILL =
  "text-footnote inline-flex items-center gap-1 rounded-full border px-2 py-0.5 tabular-nums transition-colors pointer-coarse:min-h-11";
const IDLE = "border-separator bg-fill-4 text-label-secondary hover:bg-fill-3";
const MINE = "border-tint bg-tint-fill text-tint-ink";

interface ForumReactionPillsProps {
  counts: ReactionCounts;
  /** The viewer's own reaction type, tinted. */
  mine: string | null;
  emojis?: EmojiList | undefined;
  /** A pill was pressed: open who reacted, on that type (or on all of them). */
  onOpen: (type: string) => void;
}

/**
 * A post's reactions as count pills, most reacted first, the top twelve types; a "+N" pill stands for the rest. Each
 * opens the reactors list. Nothing when the post has no reactions.
 */
export function ForumReactionPills({ counts, mine, emojis, onOpen }: ForumReactionPillsProps) {
  const types = sortedReactionTypes(counts);
  const hidden = types.length - REACTOR_TYPES_MAX;
  return (
    <>
      {types.slice(0, REACTOR_TYPES_MAX).map((type) => {
        const count = counts[type] ?? 0;
        const yours = type === mine ? ", yours included" : "";
        return (
          <button
            key={type}
            type="button"
            onClick={() => onOpen(type)}
            aria-label={`${count} ${reactionLabel(type)}${yours}, see who reacted`}
            className={cn(PILL, type === mine ? MINE : IDLE)}
          >
            <ReactionGlyph type={type} emojis={emojis} />
            <span>{count}</span>
          </button>
        );
      })}
      {hidden > 0 ? (
        <button
          type="button"
          onClick={() => onOpen(ALL_REACTIONS)}
          aria-label={`${hidden} more reaction types, see who reacted`}
          className={cn(PILL, IDLE)}
        >
          +{hidden}
        </button>
      ) : null}
    </>
  );
}
