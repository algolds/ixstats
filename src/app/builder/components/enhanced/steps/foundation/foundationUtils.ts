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

export const HISTORICAL_ARCHETYPE_IDS = [
  "british-empire",
  "venetian-republic",
  "hanseatic-league",
  "dutch-golden-age",
  "industrial-revolution",
  "soviet-command",
  "american-gilded-age",
  "french-mercantilism",
  "ottoman-empire",
  "chinese-ming-dynasty",
] as const;

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

export function getComplexityBadgeClass(complexity: string): string {
  const comp = (complexity || "medium").toLowerCase();
  if (comp === "high") {
    return "text-rose-600 dark:text-rose-400 bg-rose-500/10 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/30 shadow-[0_0_8px_rgba(244,63,94,0.08)]";
  }
  if (comp === "low") {
    return "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/30 shadow-[0_0_8px_rgba(16,185,129,0.08)]";
  }
  return "text-blue-600 dark:text-blue-400 bg-blue-500/10 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/30 shadow-[0_0_8px_rgba(59,130,246,0.08)]";
}

export function getArchetypeColorClass(key: string): string {
  const keyLower = key.toLowerCase();
  if (keyLower.includes("nordic") || keyLower.includes("social"))
    return "text-emerald-600 dark:text-emerald-400 border-emerald-500/20 bg-emerald-500/10 dark:bg-emerald-500/5 hover:border-emerald-500/40 shadow-emerald-950/20";
  if (keyLower.includes("valley") || keyLower.includes("capital") || keyLower.includes("free"))
    return "text-cyan-600 dark:text-cyan-400 border-cyan-500/20 bg-cyan-500/10 dark:bg-cyan-500/5 hover:border-cyan-500/40 shadow-cyan-950/20";
  if (keyLower.includes("command") || keyLower.includes("state") || keyLower.includes("plan"))
    return "text-rose-600 dark:text-rose-400 border-rose-500/20 bg-rose-500/10 dark:bg-rose-500/5 hover:border-rose-500/40 shadow-rose-950/20";
  if (keyLower.includes("industrial") || keyLower.includes("export"))
    return "text-blue-600 dark:text-blue-400 border-blue-500/20 bg-blue-500/10 dark:bg-blue-500/5 hover:border-blue-500/40 shadow-blue-950/20";
  if (keyLower.includes("resource") || keyLower.includes("rentier"))
    return "text-amber-600 dark:text-amber-400 border-amber-500/20 bg-amber-500/10 dark:bg-amber-500/5 hover:border-amber-500/40 shadow-amber-950/20";
  return "text-amber-600 dark:text-amber-400 border-amber-500/20 bg-amber-500/10 dark:bg-amber-500/5 hover:border-amber-500/40 shadow-amber-950/20";
}

export function getStepLabel(step: string): string {
  switch (step) {
    case "core":
    case "identity":
      return "National Identity Phase";
    case "government":
      return "Government Phase";
    case "economics":
      return "Economics Phase";
    case "preview":
      return "Preview & Create Phase";
    case "foundation":
    default:
      return "Foundation Phase";
  }
}
