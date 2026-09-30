import type { ComponentType, CSSProperties } from "react";
import {
  Tournament,
  Tower,
  Page,
  Palette,
  Church,
  Coins,
  SeaWaves,
  HomeSimple,
  Bank,
  User,
  ChatBubble,
  Flash,
  Leaf,
  Compass,
  MapPin,
} from "iconoir-react";

type IconComponent = ComponentType<{
  className?: string;
  style?: CSSProperties;
  "aria-hidden"?: boolean;
}>;

/** Iconoir glyph per story-pin category (Facet bans emoji-as-icon). */
export const CATEGORY_ICONS: Record<string, IconComponent> = {
  battle: Tournament,
  founding: Tower,
  treaty: Page,
  cultural: Palette,
  religious: Church,
  trade: Coins,
  naval: SeaWaves,
  settlement: HomeSimple,
  government: Bank,
  biography: User,
  linguistic: ChatBubble,
  upheaval: Flash,
  natural: Leaf,
  exploration: Compass,
};

export function getCategoryIcon(category: string): IconComponent {
  return CATEGORY_ICONS[category] ?? MapPin;
}

export const IMPORTANCE_LABELS = ["", "Major Event", "Legendary"];
