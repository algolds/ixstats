"use client";

import { motion } from "motion/react";
import Link from "next/link";
import {
  Crown,
  WhiteFlag as Flag,
  City as Building2,
  StatUp as TrendingUp,
  CheckCircle,
  Sparks as Sparkles,
  Lock,
  ArrowRight,
  Download,
} from "iconoir-react";
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
const STEP_ICON_STYLES: Record<(typeof BUILD_STEPS)[number], { box: string; hoverRotate: number }> =
  {
    foundation: {
      box: "bg-purple/10 text-purple",
      hoverRotate: -10,
    },
    identity: {
      box: "bg-blue/10 text-blue",
      hoverRotate: 10,
    },
    government: {
      box: "bg-indigo/10 text-indigo",
      hoverRotate: -8,
    },
    economics: {
      box: "bg-green/10 text-green",
      hoverRotate: 8,
    },
    preview: {
      box: "bg-red/10 text-red",
      hoverRotate: -6,
    },
    import: {
      box: "bg-blue/10 text-blue",
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
      <div className={"relative overflow-hidden p-5 md:p-8 " + splashGold.panel}>
        <div className="relative z-10">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <motion.div className={`h-12 w-12 shrink-0 md:h-14 md:w-14 ${splashGold.iconWrap}`}>
                <Sparkles className="h-6 w-6 md:h-7 md:w-7" aria-hidden />
              </motion.div>
              <div>
                <Badge className={`mb-2 ${splashGold.badge}`}>MyCountry © Builder</Badge>
                <h2 className={`text-title-1 md:text-large-title ${splashGold.headline}`}>
                  Begin at the blueprint
                </h2>
                <p className="text-label-secondary text-body md:text-body mt-3 max-w-2xl leading-relaxed">
                  Geography, identity, institutions, economy — then a clean preview before you enter
                  the world. Publish when it feels right; your command surface unlocks the moment
                  you&apos;re ready to lead.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 md:flex-col md:items-end">
              <Link href="/builder">
                <Button className="w-full md:w-auto">
                  Launch MyCountry Builder
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          <div
            className={`text-label-secondary rounded-row text-body mb-6 flex flex-wrap items-center gap-2 px-3 py-2.5 ${splashGold.subtlePanel}`}
          >
            <motion.span>
              <Lock className={`inline h-4 w-4 ${splashGold.text}`} aria-hidden />
            </motion.span>
            <span>
              Sign in to save. Until then, click through — nothing&apos;s locked behind mystery;
              it&apos;s just waiting for your account.
            </span>
          </div>

          <div className="relative">
            <div
              className={`absolute top-9 right-0 left-0 hidden h-px md:left-4 md:block ${splashGold.divider}`}
              aria-hidden
            />
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
                      className={`bg-surface-secondary bg-surface rounded-row flex h-full flex-col p-3 text-left md:p-4 ${splashGold.border}`}
                      initial="rest"
                      whileHover="hover"
                      variants={{ rest: {}, hover: {} }}
                    >
                      <motion.div
                        className={`rounded-control mb-2 flex h-10 w-10 shrink-0 items-center justify-center border ${iconStyle.box} [&>svg]:text-current`}
                        variants={iconVariants}
                        transition={{ type: "spring", stiffness: 380, damping: 22 }}
                      >
                        <Icon className="h-5 w-5" aria-hidden />
                      </motion.div>
                      <span className="text-label-secondary text-eyebrow mb-0.5">Step {i + 1}</span>
                      <span className={`text-headline ${splashGold.text}`}>
                        {theme.flavorTitle}
                      </span>
                      <span className="text-label-secondary text-footnote mt-1 leading-snug">
                        {theme.flavorSubtitle}
                      </span>
                    </motion.div>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="text-label-secondary text-footnote md:text-body mt-6 flex flex-wrap gap-3">
            <span className={`rounded-control px-3 py-1.5 ${splashGold.subtlePanel}`}>
              Optional: <strong className={`font-medium ${splashGold.text}`}>IxWiki import</strong>{" "}
              before foundation
            </span>
            <Link
              href="/help/gameplay/country-building"
              className={`rounded-control px-3 py-1.5 font-medium ${splashGold.subtlePanel} ${splashGold.text} hover:underline`}
            >
              How building works →
            </Link>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
