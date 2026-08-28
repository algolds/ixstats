import type { CardRarity } from "@prisma/client";

export const ALL_RARITIES: (CardRarity | string)[] = [
  "COMMON",
  "UNCOMMON",
  "RARE",
  "ULTRA_RARE",
  "EPIC",
  "LEGENDARY",
  "MYTHIC",
  "DIVINE",
];

export const COLOR_PRESETS = [
  {
    id: "auto",
    label: "Auto (Category Accent)",
    value: "",
    bgClass: "bg-gradient-to-tr from-amber-500 via-cyan-400 to-rose-500",
  },
  { id: "gold", label: "Imperial Gold", value: "#f59e0b", bgClass: "bg-amber-500" },
  { id: "cyan", label: "Electric Cyan", value: "#06b6d4", bgClass: "bg-cyan-500" },
  { id: "crimson", label: "Crimson Red", value: "#ef4444", bgClass: "bg-rose-500" },
  { id: "emerald", label: "Emerald Green", value: "#10b981", bgClass: "bg-emerald-500" },
  { id: "purple", label: "Amethyst Purple", value: "#a855f7", bgClass: "bg-purple-500" },
  { id: "pink", label: "Rose Pink", value: "#f43f5e", bgClass: "bg-pink-500" },
  { id: "silver", label: "Platinum Silver", value: "#cbd5e1", bgClass: "bg-slate-300" },
  { id: "white", label: "Solar White", value: "#ffffff", bgClass: "bg-white" },
  { id: "dark", label: "Obsidian Dark", value: "#1e293b", bgClass: "bg-slate-800" },
];
