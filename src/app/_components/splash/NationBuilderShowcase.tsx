"use client";

import { motion } from "motion/react";
import Link from "next/link";
import {
  Crown,
  Flag,
  Building2,
  TrendingUp,
  CheckCircle,
  Sparkles,
  Lock,
  ArrowRight,
  Download,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { BUILD_STEPS, BUILDER_THEME, type BuilderSection } from "~/app/builder/lib/builder-theme";
import { splashGold } from "~/lib/splash/mycountry-gold";

const STEP_ICONS: Record<(typeof BUILD_STEPS)[number], typeof Crown> = {
  foundation: Crown,
  identity: Flag,
  government: Building2,
  economics: TrendingUp,
  preview: CheckCircle,
  import: Download,
};

/** Per-step icon tiles: distinct hues + hover motion (scale / lift / tilt). */
const STEP_ICON_STYLES: Record<
  (typeof BUILD_STEPS)[number],
  { box: string; hoverRotate: number }
> = {
  foundation: {
    box: "border-violet-400/50 bg-gradient-to-br from-violet-500 to-purple-800 shadow-md shadow-violet-500/20",
    hoverRotate: -10,
  },
  identity: {
    box: "border-sky-400/50 bg-gradient-to-br from-sky-500 to-blue-800 shadow-md shadow-sky-500/20",
    hoverRotate: 10,
  },
  government: {
    box: "border-indigo-400/50 bg-gradient-to-br from-indigo-500 to-slate-900 shadow-md shadow-indigo-500/20",
    hoverRotate: -8,
  },
  economics: {
    box: "border-emerald-400/50 bg-gradient-to-br from-emerald-500 to-teal-800 shadow-md shadow-emerald-500/20",
    hoverRotate: 8,
  },
  preview: {
    box: "border-rose-400/50 bg-gradient-to-br from-rose-500 to-orange-800 shadow-md shadow-rose-500/20",
    hoverRotate: -6,
  },
  import: {
    box: "border-blue-400/50 bg-gradient-to-br from-blue-500 to-slate-900 shadow-md shadow-blue-500/20",
    hoverRotate: 12,
  },
};

export function NationBuilderShowcase() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7 }}
      className="mx-auto mb-16 max-w-7xl md:mb-20"
    >
      <div className={`glass-hierarchy-parent relative overflow-hidden p-5 md:p-8 ${splashGold.panel}`}>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-amber-500/5 to-transparent dark:from-amber-400/5" />

        <div className="relative z-10">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <motion.div
                className={`h-12 w-12 shrink-0 md:h-14 md:w-14 ${splashGold.iconWrap}`}
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
              >
                <Sparkles className="h-6 w-6 md:h-7 md:w-7" aria-hidden />
              </motion.div>
              <div>
                <Badge className={`mb-2 ${splashGold.badge}`}>MyCountry © Builder</Badge>
                <h2 className={`text-2xl font-bold md:text-4xl ${splashGold.headline}`}>Begin at the blueprint</h2>
                <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-relaxed md:text-base">
                  Geography, identity, institutions, economy — then a clean preview before you enter the world. Publish
                  when it feels right; your command surface unlocks the moment you&apos;re ready to lead.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 md:flex-col md:items-end">
              <Link href="/builder">
                <Button
                  className={`w-full bg-gradient-to-r text-white md:w-auto ${splashGold.gradient} ${splashGold.activeGlow} hover:opacity-95`}
                >
                  Launch MyCountry Builder
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          <div className={`mb-6 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-muted-foreground ${splashGold.subtlePanel}`}>
            <motion.span
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            >
              <Lock className={`inline h-4 w-4 ${splashGold.text}`} aria-hidden />
            </motion.span>
            <span>
              Sign in to save. Until then, click through — nothing&apos;s locked behind mystery; it&apos;s just waiting
              for your account.
            </span>
          </div>

          <div className="relative">
            <div className={`absolute top-9 right-0 left-0 hidden h-px md:left-4 md:block ${splashGold.divider}`} aria-hidden />
            <ol className="relative grid grid-cols-1 gap-4 md:grid-cols-5 md:gap-2">
              {BUILD_STEPS.map((section, i) => {
                const theme = BUILDER_THEME[section as BuilderSection];
                const Icon = STEP_ICONS[section];
                const iconStyle = STEP_ICON_STYLES[section];
                const iconVariants = {
                  rest: { scale: 1, y: 0, rotate: 0 },
                  hover: {
                    scale: 1.14,
                    y: -4,
                    rotate: iconStyle.hoverRotate,
                  },
                };

                return (
                  <li key={section} className="relative">
                    <motion.div
                      className={`glass-hierarchy-child flex h-full flex-col rounded-xl border bg-card/40 p-3 text-left md:p-4 ${splashGold.border} dark:bg-card/20`}
                      initial="rest"
                      whileHover="hover"
                      variants={{ rest: {}, hover: {} }}
                    >
                      <motion.div
                        className={`mb-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${iconStyle.box} [&>svg]:text-white`}
                        variants={iconVariants}
                        transition={{ type: "spring", stiffness: 380, damping: 22 }}
                      >
                        <Icon className="h-5 w-5" aria-hidden />
                      </motion.div>
                      <span className="text-muted-foreground mb-0.5 text-[10px] font-medium tracking-wider uppercase">
                        Step {i + 1}
                      </span>
                      <span className={`text-sm font-semibold ${splashGold.text}`}>{theme.flavorTitle}</span>
                      <span className="text-muted-foreground mt-1 text-xs leading-snug">{theme.flavorSubtitle}</span>
                    </motion.div>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="mt-6 flex flex-wrap gap-3 text-xs text-muted-foreground md:text-sm">
            <span className={`rounded-lg px-3 py-1.5 ${splashGold.subtlePanel}`}>
              Optional: <strong className={`font-medium ${splashGold.text}`}>IxWiki import</strong> before foundation
            </span>
            <Link
              href="/help/gameplay/country-building"
              className={`rounded-lg px-3 py-1.5 font-medium ${splashGold.subtlePanel} ${splashGold.text} hover:underline`}
            >
              How building works →
            </Link>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
