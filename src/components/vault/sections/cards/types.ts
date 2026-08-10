import { Layers, Folder, Globe } from "lucide-react";
import type { CardRarity, CardType } from "@prisma/client";

export type SubTab = "inventory" | "collections" | "gallery";

export const SUB_TABS: { id: SubTab; label: string; icon: typeof Layers }[] = [
  { id: "inventory", label: "Inventory", icon: Layers },
  { id: "collections", label: "Collections", icon: Folder },
  { id: "gallery", label: "Card Gallery", icon: Globe },
];

export type ViewMode = "grid" | "list" | "compact";
export type GallerySource = "all" | "ns" | "lore";

export interface FilterState {
  search: string;
  rarity: CardRarity | "all";
  cardType: CardType | "all";
  season: number | "all";
  minLevel: number;
  maxLevel: number;
  minValue: number;
  maxValue: number;
}

export interface VaultCardsSectionProps {
  initialTab?: string | null;
}
