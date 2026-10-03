import type { ComponentType } from "react";
import type { Variants } from "motion/react";
import {
  Sparks as Sparkles,
  Cpu,
  Shield,
  FireFlame as Flame,
  Coins,
  Bank as Landmark,
} from "iconoir-react";

export const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
    },
  },
};

export const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.23, 1, 0.32, 1] as const,
    },
  },
};

export const stepVariants: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 32 : -32,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 380,
      damping: 34,
    },
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -32 : 32,
    opacity: 0,
    transition: {
      type: "spring",
      stiffness: 380,
      damping: 34,
    },
  }),
};

export function getHighResFlagUrl(url: string | null | undefined): string | null | undefined {
  if (!url) return url;
  if (url.includes("flagcdn.com")) {
    return url.replace(/\/w\d+\/([a-z0-9_-]+)\.(png|jpg|jpeg|gif|webp)$/i, "/$1.svg");
  }
  return url;
}

export function formatFullWordNumber(num: number | undefined | null): string {
  if (!num) return "0";
  if (num >= 1e9) {
    return `${(num / 1e9).toLocaleString(undefined, { maximumFractionDigits: 1 })} billion`;
  }
  if (num >= 1e6) {
    return `${(num / 1e6).toLocaleString(undefined, { maximumFractionDigits: 1 })} million`;
  }
  if (num >= 1e3) {
    return `${(num / 1e3).toLocaleString(undefined, { maximumFractionDigits: 1 })} thousand`;
  }
  return num.toLocaleString();
}

export function formatFullWordCurrency(num: number | undefined | null): string {
  if (!num) return "$0";
  if (num >= 1e12) {
    return `$${(num / 1e12).toLocaleString(undefined, { maximumFractionDigits: 1 })} trillion`;
  }
  if (num >= 1e9) {
    return `$${(num / 1e9).toLocaleString(undefined, { maximumFractionDigits: 1 })} billion`;
  }
  if (num >= 1e6) {
    return `$${(num / 1e6).toLocaleString(undefined, { maximumFractionDigits: 1 })} million`;
  }
  return `$${num.toLocaleString()}`;
}

export function getArchetypeIcon(key: string): ComponentType<{ className?: string }> {
  const keyLower = key.toLowerCase();
  if (keyLower.includes("nordic") || keyLower.includes("social")) return Sparkles;
  if (keyLower.includes("valley") || keyLower.includes("capital") || keyLower.includes("free"))
    return Cpu;
  if (keyLower.includes("command") || keyLower.includes("state") || keyLower.includes("plan"))
    return Shield;
  if (keyLower.includes("industrial") || keyLower.includes("export")) return Flame;
  if (keyLower.includes("resource") || keyLower.includes("rentier")) return Coins;
  return Landmark;
}

/** Badge variant for an archetype's implementation complexity (status roles). */
export function getComplexityBadgeVariant(complexity: string): "destructive" | "success" | "info" {
  const comp = (complexity || "medium").toLowerCase();
  if (comp === "high") return "destructive";
  if (comp === "low") return "success";
  return "info";
}

/** Role classes for the same complexity chip (kept for callers that style their own chip). */
export function getComplexityBadgeClass(complexity: string): string {
  const variant = getComplexityBadgeVariant(complexity);
  if (variant === "destructive") return "text-red bg-red/10 border border-red/30";
  if (variant === "success") return "text-green bg-green/10 border border-green/30";
  return "text-blue bg-blue/10 border border-blue/30";
}

/** A `text-<colour>` + tinted background pair (system colours) for an archetype icon tile. */
export function getArchetypeColorClass(key: string): string {
  const keyLower = key.toLowerCase();
  if (keyLower.includes("nordic") || keyLower.includes("social")) return "text-green bg-green/10";
  if (keyLower.includes("valley") || keyLower.includes("capital") || keyLower.includes("free"))
    return "text-teal bg-teal/10";
  if (keyLower.includes("command") || keyLower.includes("state") || keyLower.includes("plan"))
    return "text-red bg-red/10";
  if (keyLower.includes("industrial") || keyLower.includes("export")) return "text-blue bg-blue/10";
  if (keyLower.includes("resource") || keyLower.includes("rentier"))
    return "text-yellow bg-yellow/10";
  return "text-tint bg-tint-fill";
}

export function getStepLabel(step: string): string {
  switch (step) {
    case "core":
    case "identity":
      return "National identity";
    case "government":
      return "Government";
    case "economics":
      return "Economics";
    case "preview":
      return "Preview and create";
    case "foundation":
    default:
      return "Foundation";
  }
}
