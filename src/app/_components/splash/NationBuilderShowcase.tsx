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
                <Badge className={`mb-2 ${splashGold.badge}`} variant="secondary">
                  MyCountry builder
                </Badge>
                <h2 className={`text-title-1 md:text-large-title ${splashGold.headline}`}>
                  Build your country
                </h2>
                <p className="text-label-secondary text-body md:text-body mt-3 max-w-2xl leading-relaxed">
                  Set up your country&apos;s identity, government and economy, then preview it
                  before you publish. Publishing opens MyCountry, where you run the nation.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 md:flex-col md:items-end">
              <Button asChild className="w-full md:w-auto">
                <Link href="/builder">
                  Build your nation
                  <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div
            className={`text-label-secondary rounded-row text-body mb-6 flex flex-wrap items-center gap-2 px-3 py-3 ${splashGold.subtlePanel}`}
          >
            <motion.span>
              <Lock className={`inline h-4 w-4 ${splashGold.text}`} aria-hidden />
            </motion.span>
            <span>
              Sign in to save your progress. You can click through the builder without an account.
            </span>
          </div>

          <div className="relative">
            <ol className="relative grid grid-cols-1 gap-4 md:grid-cols-5 md:gap-2">
              {BUILD_STEPS.map((section, i) => {
                const theme = BUILDER_THEME[section as BuilderSection];
                const Icon = STEP_ICONS[section];

                return (
                  <li key={section} className="relative">
                    <div
                      className={`bg-surface rounded-row flex h-full flex-col border p-3 text-left md:p-4 ${splashGold.border}`}
                    >
                      <div className="bg-fill-3 text-label-secondary rounded-control mb-2 flex h-10 w-10 shrink-0 items-center justify-center">
                        <Icon className="h-5 w-5" aria-hidden />
                      </div>
                      <span className="text-label-secondary text-eyebrow mb-0.5">Step {i + 1}</span>
                      <span className={`text-headline ${splashGold.text}`}>
                        {theme.flavorTitle}
                      </span>
                      <span className="text-label-secondary text-footnote mt-1 leading-snug">
                        {theme.flavorSubtitle}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="text-label-secondary text-footnote md:text-body mt-6 flex flex-wrap gap-3">
            <span className={`rounded-control px-3 py-2 ${splashGold.subtlePanel}`}>
              Optional: <strong className={`font-medium ${splashGold.text}`}>IxWiki import</strong>{" "}
              before the foundation step
            </span>
            <Link
              href="/help/gameplay/country-building"
              className={`rounded-control px-3 py-2 font-medium ${splashGold.subtlePanel} ${splashGold.text} hover:underline`}
            >
              How building works
            </Link>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
