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

/** Badge variant for an implementation complexity (status roles, Facet 3 §7.1). */
export function getComplexityBadgeVariant(
  complexity: string | undefined
): "success" | "caution" | "destructive" | "neutral" {
  switch ((complexity ?? "").toLowerCase()) {
    case "low":
      return "success";
    case "medium":
      return "caution";
    case "high":
      return "destructive";
    default:
      return "neutral";
  }
}

export function getComplexityColor(complexity: "low" | "medium" | "high"): string {
  switch (complexity) {
    case "low":
      return "bg-green/10 text-green-ink border border-green/20";
    case "medium":
      return "bg-yellow/10 text-yellow-ink border border-yellow/20";
    case "high":
      return "bg-red/10 text-red-ink border border-red/20";
    default:
      return "bg-fill-3 text-label-secondary border border-separator";
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

export function getArchetypeColors(archetypeId: string): {
  bg: string;
  border: string;
  text: string;
} {
  const colorMap: Record<string, { bg: string; border: string; text: string }> = {
    "silicon-valley": {
      bg: "bg-blue/10",
      border: "border-blue/30",
      text: "text-blue",
    },
    nordic: {
      bg: "bg-green/10",
      border: "border-green/30",
      text: "text-green",
    },
    "asian-tiger": {
      bg: "bg-orange/10",
      border: "border-orange/30",
      text: "text-orange",
    },
    "german-social-market": {
      bg: "bg-fill-3",
      border: "border-separator",
      text: "text-label-secondary",
    },
    singapore: {
      bg: "bg-teal/10",
      border: "border-teal/30",
      text: "text-teal",
    },
    swiss: {
      bg: "bg-red/10",
      border: "border-red/30",
      text: "text-red",
    },
    japanese: {
      bg: "bg-red/10",
      border: "border-red/30",
      text: "text-red",
    },
    australian: {
      bg: "bg-yellow/10",
      border: "border-yellow/30",
      text: "text-yellow",
    },
    brazilian: {
      bg: "bg-green/10",
      border: "border-green/30",
      text: "text-green",
    },
    canadian: {
      bg: "bg-red/10",
      border: "border-red/30",
      text: "text-red",
    },
    "british-empire": {
      bg: "bg-blue/10",
      border: "border-blue/30",
      text: "text-blue",
    },
    "venetian-republic": {
      bg: "bg-teal/10",
      border: "border-blue/30",
      text: "text-teal",
    },
    "hanseatic-league": {
      bg: "bg-fill-3",
      border: "border-separator",
      text: "text-label-secondary",
    },
    "dutch-golden-age": {
      bg: "bg-orange/10",
      border: "border-orange/30",
      text: "text-orange",
    },
    "industrial-revolution": {
      bg: "bg-fill-3",
      border: "border-separator",
      text: "text-label-secondary",
    },
    "soviet-command": {
      bg: "bg-red/10",
      border: "border-red/30",
      text: "text-red",
    },
    "american-gilded-age": {
      bg: "bg-yellow/10",
      border: "border-yellow/30",
      text: "text-yellow",
    },
    "french-mercantilism": {
      bg: "bg-blue/10",
      border: "border-blue/30",
      text: "text-blue",
    },
    "ottoman-empire": {
      bg: "bg-red/10",
      border: "border-red/30",
      text: "text-red",
    },
    "chinese-ming-dynasty": {
      bg: "bg-yellow/10",
      border: "border-red/30",
      text: "text-yellow",
    },
  };

  return (
    colorMap[archetypeId] || {
      bg: "bg-blue/10",
      border: "border-blue/30",
      text: "text-blue",
    }
  );
}
