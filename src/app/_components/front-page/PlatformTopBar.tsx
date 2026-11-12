"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { Crown, Globe, Group as Users, NavArrowRight } from "iconoir-react";
import { motion } from "motion/react";
import { useFacetReducedMotion } from "~/components/providers/FacetMotionConfig";
import { FacetMaterial } from "~/components/ui/facet";
import { MonogramLayer } from "~/components/ui/facet/shared/MonogramLayer";
import { useMercuryLens } from "~/hooks/useMercuryLens";
import { usePointerParallax } from "~/hooks/usePointerParallax";
import { Button, hitSlop } from "~/components/ui/button";
import { SignInButton } from "~/context/auth-context";
import { withBasePath } from "~/lib/base-path";
import { cn } from "~/lib/utils/cn";
import type { RouterOutputs } from "~/trpc/react";

type FrontPageFacts = RouterOutputs["frontPage"]["get"]["facts"];

/**
 * The monogram's layers, each a tile in its app's tint: the emblem and the W in the Wiki navy. `depth`
 * is how far a layer drifts from the pointer, in px at the hero's edge: the emblems sit deeper than the
 * app marks, so the pattern separates into two planes as the mouse moves.
 */
const MONOGRAM_LAYERS = (
  [
    ["wiki", 8],
    ["mycountry", 16],
    ["maps", 16],
    ["realms", 16],
  ] as const
).map(([app, depth]) => ({
  app,
  depth,
  style: {
    "--monogram": `url("${withBasePath(`/images/ix-monogram-${app}.svg`)}")`,
  } as CSSProperties,
}));

/** The emblem, painted in the Wiki tint through a mask so it holds contrast in both themes. */
const EMBLEM_STYLE = {
  maskImage: `url("${withBasePath("/images/ix-logo.svg?v=2")}")`,
  maskSize: "contain",
  maskRepeat: "no-repeat",
} satisfies CSSProperties;

const WORDMARK_STYLE = {
  maskImage: `url("${withBasePath("/images/ixstates-wordmark.svg")}")`,
  maskSize: "contain",
  maskRepeat: "no-repeat",
} satisfies CSSProperties;

const MotionFacetMaterial = motion.create(FacetMaterial);

export function PlatformTopBar({ facts }: { facts: FrontPageFacts | undefined }) {
  const reduceMotion = useFacetReducedMotion();
  const { px, py, onPointerMove, onPointerLeave } = usePointerParallax(reduceMotion);
  const mercury = useMercuryLens(reduceMotion);

  const platformStats = [
    {
      href: "/realms",
      icon: Globe,
      tone: "text-blue",
      label: "realms",
      value: facts ? facts.realms.toLocaleString() : "–",
    },
    {
      href: "/countries",
      icon: Crown,
      tone: "text-yellow",
      label: "nations",
      value: facts ? facts.nations.toLocaleString() : "–",
    },
    {
      href: "/thinkpages",
      icon: Users,
      tone: "text-teal",
      label: "players",
      value: facts ? facts.players.toLocaleString() : "–",
    },
  ] as const;

  return (
    <div className="border-separator border-b text-center">
      <div
        className="relative overflow-hidden px-4 py-8 md:py-10"
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 print:hidden">
          {MONOGRAM_LAYERS.map((layer) => (
            <MonogramLayer key={layer.app} {...layer} px={px} py={py} className="-inset-6" />
          ))}
        </div>
        <MotionFacetMaterial
          layer="lens"
          aria-hidden
          style={mercury.lensStyle}
          className="pointer-events-none absolute inset-x-3 inset-y-4 mx-auto max-w-[640px] rounded-[32px] md:inset-y-5 print:hidden"
        />
        <motion.div
          style={mercury.contentStyle}
          {...mercury.handlers}
          className="relative mx-auto flex max-w-[640px] cursor-grab touch-pan-y flex-col items-center select-none active:cursor-grabbing"
        >
          <span
            aria-hidden
            data-app="wiki"
            className="bg-tint block size-16"
            style={EMBLEM_STYLE}
          />
          {/* The wordmark asset (Schibsted Grotesk 800, hand-spaced, outlined) painted in the label ink
                through a mask, so it follows the theme. Sized in em off text-display: 74 of its 100-unit
                em tall, so it scales with the user's text size like the title it replaces. */}
          <h1 className="text-display mt-4 leading-none">
            <span className="sr-only">IxStates</span>
            <span
              aria-hidden
              className="bg-label block aspect-[417/74] h-[0.74em]"
              style={WORDMARK_STYLE}
            />
          </h1>
          <p className="text-title-3 text-label-secondary mt-2 font-normal">
            The operating system for worldbuilding
          </p>
          <div
            aria-label="Platform totals"
            className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1"
          >
            {platformStats.map(({ href, icon: Icon, tone, label, value }) => (
              <Link
                key={label}
                href={href}
                className={cn(
                  "text-footnote text-label-secondary hover:text-label focus-visible:outline-tint rounded-control-sm duration-fast relative inline-flex items-center gap-1.5 tabular-nums transition-colors focus-visible:outline-2",
                  hitSlop
                )}
              >
                <Icon aria-hidden className={cn(tone, "size-3.5 shrink-0")} />
                <span className="text-label font-medium">{value}</span>
                <span>{label}</span>
              </Link>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {/* ponytail: Clerk's sign-in-or-up flow; the email decides which, so one button covers both */}
            <SignInButton mode="modal" withSignUp>
              <Button size="lg" className="rounded-full">
                <span>Sign in</span>
                <NavArrowRight aria-hidden />
              </Button>
            </SignInButton>
            <Button variant="secondary" size="lg" className="rounded-full" asChild>
              <Link href="/realms">Explore realms</Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
