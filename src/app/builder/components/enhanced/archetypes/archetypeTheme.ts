import React from "react";
import {
  Globe,
  Cpu,
  ModernTv as Mountain,
  Industry as Factory,
  Leaf,
  Dollar as Banknote,
  Crown,
  DeliveryTruck as Ship,
  Car,
  Wrench,
  Hammer,
  Hammer as Gavel,
  OpenBook as BookOpen,
  Tree as TreePine,
  Farm as Wheat,
  Hammer as Pickaxe,
  Building,
  Bank as Landmark,
  City as Building2,
} from "iconoir-react";

export function getComplexityColor(complexity: "low" | "medium" | "high"): string {
  switch (complexity) {
    case "low":
      return "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20";
    case "medium":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20";
    case "high":
      return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20";
    default:
      return "bg-muted text-muted-foreground border border-border";
  }
}

export function getArchetypeIcon(archetypeId: string): React.ComponentType<{ className?: string }> {
  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    "silicon-valley": Cpu,
    nordic: Leaf,
    "asian-tiger": Factory,
    "german-social-market": Building2,
    singapore: Banknote,
    swiss: Mountain,
    japanese: Car,
    australian: Pickaxe,
    brazilian: Wheat,
    canadian: TreePine,
    "british-empire": Crown,
    "venetian-republic": Ship,
    "hanseatic-league": Globe,
    "dutch-golden-age": Banknote,
    "industrial-revolution": Wrench,
    "soviet-command": Hammer,
    "american-gilded-age": Building,
    "french-mercantilism": Gavel,
    "ottoman-empire": Landmark,
    "chinese-ming-dynasty": BookOpen,
  };
  return iconMap[archetypeId] || Globe;
}

export function getArchetypeColors(archetypeId: string): { bg: string; border: string; text: string } {
  const colorMap: Record<string, { bg: string; border: string; text: string }> = {
    "silicon-valley": {
      bg: "from-blue-500 to-purple-600",
      border: "border-blue-200/50 dark:border-blue-800/50",
      text: "text-blue-600 dark:text-blue-400",
    },
    nordic: {
      bg: "from-green-500 to-emerald-600",
      border: "border-green-200/50 dark:border-green-800/50",
      text: "text-emerald-600 dark:text-emerald-400",
    },
    "asian-tiger": {
      bg: "from-orange-500 to-red-600",
      border: "border-orange-200/50 dark:border-orange-800/50",
      text: "text-orange-600 dark:text-orange-400",
    },
    "german-social-market": {
      bg: "from-gray-500 to-slate-600",
      border: "border-gray-200/50 dark:border-gray-800/50",
      text: "text-zinc-600 dark:text-zinc-400",
    },
    singapore: {
      bg: "from-cyan-500 to-blue-600",
      border: "border-cyan-200/50 dark:border-cyan-800/50",
      text: "text-cyan-600 dark:text-cyan-400",
    },
    swiss: {
      bg: "from-red-500 to-white",
      border: "border-red-200/50 dark:border-red-800/50",
      text: "text-red-600 dark:text-red-400",
    },
    japanese: {
      bg: "from-red-500 to-pink-600",
      border: "border-red-200/50 dark:border-red-800/50",
      text: "text-rose-600 dark:text-rose-400",
    },
    australian: {
      bg: "from-yellow-500 to-orange-600",
      border: "border-yellow-200/50 dark:border-yellow-800/50",
      text: "text-amber-600 dark:text-amber-400",
    },
    brazilian: {
      bg: "from-green-500 to-yellow-600",
      border: "border-green-200/50 dark:border-green-800/50",
      text: "text-emerald-600 dark:text-emerald-400",
    },
    canadian: {
      bg: "from-red-500 to-white",
      border: "border-red-200/50 dark:border-red-800/50",
      text: "text-rose-600 dark:text-rose-400",
    },
    "british-empire": {
      bg: "from-blue-500 to-red-600",
      border: "border-blue-200/50 dark:border-blue-800/50",
      text: "text-blue-600 dark:text-blue-400",
    },
    "venetian-republic": {
      bg: "from-blue-500 to-cyan-600",
      border: "border-blue-200/50 dark:border-blue-800/50",
      text: "text-cyan-600 dark:text-cyan-400",
    },
    "hanseatic-league": {
      bg: "from-gray-500 to-blue-600",
      border: "border-gray-200/50 dark:border-gray-800/50",
      text: "text-zinc-600 dark:text-zinc-400",
    },
    "dutch-golden-age": {
      bg: "from-orange-500 to-white",
      border: "border-orange-200/50 dark:border-orange-800/50",
      text: "text-orange-600 dark:text-orange-400",
    },
    "industrial-revolution": {
      bg: "from-gray-500 to-black",
      border: "border-gray-200/50 dark:border-gray-800/50",
      text: "text-zinc-500",
    },
    "soviet-command": {
      bg: "from-red-500 to-yellow-600",
      border: "border-red-200/50 dark:border-red-800/50",
      text: "text-red-600 dark:text-red-400",
    },
    "american-gilded-age": {
      bg: "from-yellow-500 to-gray-600",
      border: "border-yellow-200/50 dark:border-yellow-800/50",
      text: "text-amber-600 dark:text-amber-400",
    },
    "french-mercantilism": {
      bg: "from-blue-500 to-white",
      border: "border-blue-200/50 dark:border-blue-800/50",
      text: "text-blue-600 dark:text-blue-400",
    },
    "ottoman-empire": {
      bg: "from-red-500 to-green-600",
      border: "border-red-200/50 dark:border-red-800/50",
      text: "text-red-600 dark:text-red-400",
    },
    "chinese-ming-dynasty": {
      bg: "from-red-500 to-yellow-600",
      border: "border-red-200/50 dark:border-red-800/50",
      text: "text-amber-600 dark:text-amber-400",
    },
  };

  return (
    colorMap[archetypeId] || {
      bg: "from-blue-500 to-purple-600",
      border: "border-blue-200/50 dark:border-blue-800/50",
      text: "text-blue-600 dark:text-blue-400",
    }
  );
}
