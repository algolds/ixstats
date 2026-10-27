// src/components/ui/chat-badge-icon.ts
// The icon of a user's chat badge, by the Iconoir name an admin typed into the store item. A fixed
// set, imported by name, instead of `import * as Iconoir`: indexing the whole namespace by a runtime
// string made every one of its ~1,500 icons part of every page that shows a badge.

import {
  Bank,
  Bell,
  Book,
  Bookmark,
  Brain,
  Camera,
  Compass,
  Cpu,
  Crown,
  Cube,
  Eye,
  FireFlame,
  Flare,
  Flash,
  Gift,
  Globe,
  GraduationCap,
  HalfMoon,
  Heart,
  Key,
  Leaf,
  LightBulb,
  MagicWand,
  Medal,
  Medal1st,
  MusicNote,
  Palette,
  Planet,
  Puzzle,
  Rocket,
  Shield,
  ShieldCheck,
  Sparks,
  Star,
  Trophy,
  UserCrown,
  UserStar,
  Wolf,
} from "iconoir-react";
import type { ComponentType, CSSProperties } from "react";

export type ChatBadgeIcon = ComponentType<{ className?: string; style?: CSSProperties }>;

/** The names a chat badge can use (an unknown name shows the crown). */
const CHAT_BADGE_ICONS = new Map<string, ChatBadgeIcon>(
  Object.entries({
    Bank,
    Bell,
    Book,
    Bookmark,
    Brain,
    Camera,
    Compass,
    Cpu,
    Crown,
    Cube,
    Eye,
    FireFlame,
    Flare,
    Flash,
    Gift,
    Globe,
    GraduationCap,
    HalfMoon,
    Heart,
    Key,
    Leaf,
    LightBulb,
    MagicWand,
    Medal,
    Medal1st,
    MusicNote,
    Palette,
    Planet,
    Puzzle,
    Rocket,
    Shield,
    ShieldCheck,
    Sparks,
    Star,
    Trophy,
    UserCrown,
    UserStar,
    Wolf,
  })
);

/** The badge icon named `name`, or the crown. */
export function resolveChatBadgeIcon(name: string | null | undefined): ChatBadgeIcon {
  return (name ? CHAT_BADGE_ICONS.get(name) : undefined) ?? Crown;
}
