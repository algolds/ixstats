"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { reactionLabel } from "~/lib/thinkpages-forum/reactions";
import { api } from "~/trpc/react";
import { ReactionGlyph, type EmojiList } from "./ReactionGlyph";
import { ReactorList, type ReactorGroup } from "./ReactorList";
import { ALL_REACTIONS } from "./reactors-tabs";
import { useReactionEmojis } from "./useReactionEmojis";

interface ReactorsDialogProps {
  postId: string;
  /** The reaction tab to open on, or "all". */
  type: string;
  onClose: () => void;
}

interface TabsProps {
  groups: readonly ReactorGroup[];
  active: string;
  emojis?: EmojiList | undefined;
  onChange: (tab: string) => void;
}

function ReactorTabs({ groups, active, emojis, onChange }: TabsProps) {
  const total = groups.reduce((sum, group) => sum + group.count, 0);
  return (
    <ToggleGroup
      type="single"
      variant="pill"
      size="sm"
      aria-label="Filter by reaction"
      value={active}
      onValueChange={(next) => onChange(next || ALL_REACTIONS)}
      className="border-separator flex items-center gap-2 overflow-x-auto border-b px-4 py-2"
    >
      <ToggleGroupItem value={ALL_REACTIONS} className="tabular-nums">
        All ({total})
      </ToggleGroupItem>
      {groups.map((group) => (
        <ToggleGroupItem
          key={group.type}
          value={group.type}
          aria-label={`${reactionLabel(group.type)}, ${group.count}`}
          className="tabular-nums"
        >
          <ReactionGlyph type={group.type} emojis={emojis} decorative />
          <span>{group.count}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/**
 * Who reacted to a post, by reaction (spec section 4). Each reactor is the player: their handle and flag, never a
 * persona. Mounted while open only, so a reopened dialog starts on its own tab and a closed post costs no query.
 */
export function ReactorsDialog({ postId, type, onClose }: ReactorsDialogProps) {
  const [tab, setTab] = useState(type);
  const { data, isLoading, isError, refetch } = api.thinkpagesForum.reactors.useQuery({ postId });
  const emojis = useReactionEmojis();
  const groups = data?.groups ?? [];
  const active = groups.some((group) => group.type === tab) ? tab : ALL_REACTIONS;
  const shown = active === ALL_REACTIONS ? groups : groups.filter((group) => group.type === active);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[80vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="border-separator border-b px-6 py-4 text-left">
          <DialogTitle className="text-title-3">Reactions</DialogTitle>
          <DialogDescription>Who reacted to this post</DialogDescription>
        </DialogHeader>
        <ReactorTabs groups={groups} active={active} emojis={emojis} onChange={setTab} />
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <p className="text-footnote text-label-secondary py-8 text-center">Loading reactions</p>
          ) : isError ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <p className="text-footnote text-label-secondary">Could not load who reacted.</p>
              <Button variant="secondary" size="sm" onClick={() => void refetch()}>
                Try again
              </Button>
            </div>
          ) : (
            <ReactorList groups={shown} emojis={emojis} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
