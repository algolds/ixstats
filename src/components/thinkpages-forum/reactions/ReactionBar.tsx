"use client";

import { useState } from "react";
import { Heart, NavArrowDown } from "iconoir-react";
import { ReactionPopup } from "~/components/thinkpages/ReactionPopup";
import { Button } from "~/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { DEFAULT_REACTION, type ReactionCounts } from "~/lib/thinkpages-forum/reactions";
import { cn } from "~/lib/utils/cn";
import { ForumReactionPills } from "./ForumReactionPills";
import { isDiscordReaction, ReactionGlyph } from "./ReactionGlyph";
import { ReactorsDialog } from "./ReactorsDialog";
import { useForumReaction } from "./useForumReaction";
import { useLongPress } from "./useLongPress";
import { useReactionEmojis } from "./useReactionEmojis";

const ACTION = "text-label-secondary hover:text-label pointer-coarse:min-h-11";

interface ReactionBarProps {
  postId: string;
  counts: ReactionCounts;
  /** The viewer's own reaction type. */
  mine: string | null;
  /** The viewer may react to this post: the React button and popup are offered. Pills show either way. */
  canReact: boolean;
}

/**
 * A post's reactions (spec section 4): the React button (adds like, or takes your reaction back), a chevron, a
 * right-click or a long press for the Dashboard's reaction popup, then the count pills, each opening who reacted. A
 * reader who cannot react sees the pills only; a post with no reactions and no right to react renders nothing, and
 * mounts none of the bar's hooks.
 */
export function ReactionBar(props: ReactionBarProps) {
  if (!props.canReact && Object.keys(props.counts).length === 0) return null;
  return <ReactionBarBody {...props} />;
}

function ReactionBarBody({ postId, counts, mine, canReact }: ReactionBarProps) {
  const { set, pending } = useForumReaction(postId);
  const [popup, setPopup] = useState(false);
  const [reactors, setReactors] = useState<string | null>(null);
  const longPress = useLongPress(() => setPopup(true));
  const needsEmojis =
    Object.keys(counts).some(isDiscordReaction) || (mine !== null && isDiscordReaction(mine));
  const emojis = useReactionEmojis(needsEmojis);

  const pick = (type: string) => {
    setPopup(false);
    void set(type === mine ? null : type);
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      {canReact ? (
        <div className="inline-flex items-center">
          <Button
            variant="ghost"
            size="sm"
            className={cn(ACTION, mine !== null && "text-tint")}
            aria-pressed={mine !== null}
            disabled={pending}
            {...longPress.handlers}
            onClick={() => {
              if (longPress.consume()) return;
              void set(mine === null ? DEFAULT_REACTION : null);
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              setPopup(true);
            }}
          >
            {mine !== null ? (
              <ReactionGlyph type={mine} emojis={emojis} className="size-4" decorative />
            ) : (
              <Heart aria-hidden />
            )}
            React
          </Button>
          <Popover open={popup} onOpenChange={setPopup}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className={ACTION}
                aria-label="Choose a reaction"
                disabled={pending}
              >
                <NavArrowDown aria-hidden />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="w-auto p-3">
              <ReactionPopup onSelectReaction={pick} />
            </PopoverContent>
          </Popover>
        </div>
      ) : null}
      <ForumReactionPills counts={counts} mine={mine} emojis={emojis} onOpen={setReactors} />
      {reactors !== null ? (
        <ReactorsDialog postId={postId} type={reactors} onClose={() => setReactors(null)} />
      ) : null}
    </div>
  );
}
