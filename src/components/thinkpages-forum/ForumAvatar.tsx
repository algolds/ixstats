import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { cn } from "~/lib/utils/cn";

/** Up to two capital letters from a name, for an avatar without a picture. */
export function initialsOf(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase());
  return letters.join("") || "?";
}

const SIZES = {
  xs: { box: "size-6", text: "text-caption" },
  sm: { box: "size-7", text: "text-caption" },
  md: { box: "size-9", text: "text-footnote" },
  lg: { box: "size-10", text: "text-subhead" },
} as const;

export type ForumAvatarSize = keyof typeof SIZES;

interface ForumAvatarProps {
  name: string;
  /** The picture (a member's Passport image, a persona's image); the initials show without one. */
  avatarUrl?: string | null;
  size?: ForumAvatarSize;
  className?: string;
}

/**
 * Who wrote it, as the platform shows a person: their picture, or their initials on the app tint (never a grey
 * disc). The one avatar every forum surface uses, so a fallback looks the same on the board, a thread and a rail.
 */
export function ForumAvatar({ name, avatarUrl, size = "md", className }: ForumAvatarProps) {
  const { box, text } = SIZES[size];
  return (
    <Avatar className={cn(box, className)}>
      {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
      <AvatarFallback className={cn("bg-tint-fill text-tint-ink font-medium", text)}>
        {initialsOf(name)}
      </AvatarFallback>
    </Avatar>
  );
}
