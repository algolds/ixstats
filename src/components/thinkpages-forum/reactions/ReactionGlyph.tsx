import {
  REACTION_ICONS,
  getDiscordEmojiUrl,
} from "~/components/thinkpages/post/ThinkpagesPostUtils";
import { discordReaction, reactionLabel } from "~/lib/thinkpages-forum/reactions";
import { cn } from "~/lib/utils/cn";

/** The Discord emoji list the reaction popup loads (`api.thinkpages.getDiscordEmojis`). */
export type EmojiList = Array<{ name: string; url: string }>;

/** Whether a reaction type is a Discord emoji, whose image may need the emoji list. */
export const isDiscordReaction = (type: string): boolean => discordReaction(type) !== null;

interface ReactionGlyphProps {
  type: string;
  emojis?: EmojiList | undefined;
  className?: string;
  /** The glyph sits beside a text label: no alternative text of its own. */
  decorative?: boolean;
}

/**
 * One reaction as a small glyph: the Dashboard's icon for a built-in, the emoji image for a Discord reaction (user
 * content, resolved by `getDiscordEmojiUrl`), else its name.
 */
export function ReactionGlyph({ type, emojis, className, decorative = false }: ReactionGlyphProps) {
  const url = getDiscordEmojiUrl(type, emojis);
  if (url) {
    return (
      <img
        src={url}
        alt={decorative ? "" : reactionLabel(type)}
        className={cn("size-3.5 object-contain", className)}
      />
    );
  }
  const Icon = REACTION_ICONS[type];
  if (Icon) return <Icon aria-hidden className={cn("size-3.5", className)} />;
  return <span className="text-footnote">{reactionLabel(type)}</span>;
}
