"use client";

import {
  REACTOR_TYPES_MAX,
  reactionLabel,
  sortedReactionTypes,
  type ReactionCounts,
} from "~/lib/thinkpages-forum/reactions";
import { cn } from "~/lib/utils/cn";
import { ReactionGlyph, type EmojiList } from "./ReactionGlyph";

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
 * The types to draw: the top twelve by count, except that the viewer's own reaction always has a pill, so when it falls
 * outside the twelve it takes the twelfth place.
 */
function visibleTypes(types: readonly string[], mine: string | null): string[] {
  const top = types.slice(0, REACTOR_TYPES_MAX);
  if (mine === null || top.includes(mine) || !types.includes(mine)) return top;
  return [...types.slice(0, REACTOR_TYPES_MAX - 1), mine];
}

/**
 * A post's reactions as count pills, most reacted first, at most twelve; a "+N more" note stands for the rest (the
 * reactors list covers twelve types, so it is not a button). Each pill opens the reactors list. Nothing when the post
 * has no reactions.
 */
export function ForumReactionPills({ counts, mine, emojis, onOpen }: ForumReactionPillsProps) {
  const types = sortedReactionTypes(counts);
  const shown = visibleTypes(types, mine);
  const hidden = types.length - shown.length;
  return (
    <>
      {shown.map((type) => {
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
            <ReactionGlyph type={type} emojis={emojis} decorative />
            <span>{count}</span>
          </button>
        );
      })}
      {hidden > 0 ? (
        <span
          role="img"
          aria-label={`${hidden} more reaction types`}
          className="text-footnote text-label-secondary tabular-nums"
        >
          +{hidden} more
        </span>
      ) : null}
    </>
  );
}
