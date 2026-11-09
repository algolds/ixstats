"use client";

import { useRef, type CSSProperties } from "react";
import Link from "next/link";
import { Crown, Globe, Group as Users, NavArrowRight } from "iconoir-react";
import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from "motion/react";
import { useFacetReducedMotion } from "~/components/providers/FacetMotionConfig";
import { FacetMaterial } from "~/components/ui/facet";
import { Button, hitSlop } from "~/components/ui/button";
import { SignInButton } from "~/context/auth-context";
import { withBasePath } from "~/lib/base-path";
import { springMomentum, springSmooth } from "~/lib/design/motion";
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

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const rubberband = (d: number, dim: number, k = 0.55) => (d * dim * k) / (dim + k * Math.abs(d));

function MonogramLayer({
  app,
  depth,
  style,
  px,
  py,
}: (typeof MONOGRAM_LAYERS)[number] & { px: MotionValue<number>; py: MotionValue<number> }) {
  const x = useTransform(px, (v) => v * -depth);
  const y = useTransform(py, (v) => v * -depth);
  return (
    <motion.div
      data-app={app}
      className="facet-monogram absolute -inset-6"
      style={{ ...style, x, y }}
    />
  );
}

/**
 * Liquid-mercury surface tension and rubber-band pull for the centered hero lens card:
 * instant volume-conserving squish (`scaleX * scaleY = 1`), 1:1 rubber-banded pull with
 * velocity-sensitive anisotropic stretch, and under-damped spring settle (`springMomentum`).
 */
function useMercuryLens(reduceMotion: boolean) {
  const targetX = useMotionValue(0);
  const targetY = useMotionValue(0);
  const targetScaleX = useMotionValue(1);
  const targetScaleY = useMotionValue(1);

  const lensX = useSpring(targetX, springMomentum);
  const lensY = useSpring(targetY, springMomentum);
  const lensScaleX = useSpring(targetScaleX, springMomentum);
  const lensScaleY = useSpring(targetScaleY, springMomentum);

  const contentX = useTransform(lensX, (v) => v * 0.65);
  const contentY = useTransform(lensY, (v) => v * 0.65);
  const contentScaleX = useTransform(lensScaleX, (v) => 1 + (v - 1) * 0.45);
  const contentScaleY = useTransform(lensScaleY, (v) => 1 + (v - 1) * 0.45);

  const grabRef = useRef<{
    id: number;
    x0: number;
    y0: number;
    ox: number;
    oy: number;
    lx: number;
    ly: number;
    lt: number;
  } | null>(null);

  const setDeform = (x: number, y: number, sx: number) => {
    targetX.set(x);
    targetY.set(y);
    targetScaleX.set(sx);
    targetScaleY.set(1 / sx);
  };

  const reset = () => {
    grabRef.current = null;
    setDeform(0, 0, 1);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (reduceMotion || (event.pointerType === "mouse" && event.button !== 0)) return;
    if ((event.target as HTMLElement).closest("a, button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const box = event.currentTarget.getBoundingClientRect();
    const ox = clamp(((event.clientX - box.left) / box.width) * 2 - 1, -1, 1) * 6;
    const oy = clamp(((event.clientY - box.top) / box.height) * 2 - 1, -1, 1) * 4;
    grabRef.current = {
      id: event.pointerId,
      x0: event.clientX,
      y0: event.clientY,
      ox,
      oy,
      lx: event.clientX,
      ly: event.clientY,
      lt: performance.now(),
    };
    setDeform(ox, oy, 1.038);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (reduceMotion) return;
    const g = grabRef.current;
    if (g && g.id === event.pointerId) {
      const dx = event.clientX - g.x0;
      const dy = event.clientY - g.y0;
      const now = performance.now();
      const dt = Math.max(now - g.lt, 8);
      const vx = ((event.clientX - g.lx) / dt) * 1000;
      const vy = ((event.clientY - g.ly) / dt) * 1000;
      g.lx = event.clientX;
      g.ly = event.clientY;
      g.lt = now;
      const stretch = clamp(
        (Math.abs(dx) - Math.abs(dy)) / 220 + (Math.abs(vx) - Math.abs(vy)) / 5000,
        -0.065,
        0.065
      );
      const pressMix = Math.max(0, 1 - Math.hypot(dx, dy) / 48);
      const sx = clamp(1 + 0.034 * pressMix + stretch, 0.93, 1.08);
      setDeform(g.ox + rubberband(dx, 96), g.oy + rubberband(dy, 72), sx);
      return;
    }
    if (event.pointerType === "mouse") {
      const box = event.currentTarget.getBoundingClientRect();
      const rx = clamp(((event.clientX - box.left) / box.width) * 2 - 1, -1, 1);
      const ry = clamp(((event.clientY - box.top) / box.height) * 2 - 1, -1, 1);
      setDeform(rx * 5, ry * 3.5, 1 + (Math.abs(rx) - Math.abs(ry)) * 0.014);
    }
  };

  return {
    lensStyle: { x: lensX, y: lensY, scaleX: lensScaleX, scaleY: lensScaleY },
    contentStyle: { x: contentX, y: contentY, scaleX: contentScaleX, scaleY: contentScaleY },
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: reset,
      onPointerCancel: reset,
      onLostPointerCapture: reset,
      onPointerLeave: () => {
        if (!grabRef.current) reset();
      },
    },
  };
}

export function PlatformTopBar({ facts }: { facts: FrontPageFacts | undefined }) {
  const reduceMotion = useFacetReducedMotion();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const px = useSpring(pointerX, springSmooth);
  const py = useSpring(pointerY, springSmooth);
  const mercury = useMercuryLens(reduceMotion);

  // The pointer's place in the hero, -1 to 1 on each axis; mouse only (touch has no hover to follow).
  const followPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || reduceMotion) return;
    const box = event.currentTarget.getBoundingClientRect();
    pointerX.set(((event.clientX - box.left) / box.width) * 2 - 1);
    pointerY.set(((event.clientY - box.top) / box.height) * 2 - 1);
  };
  const recentre = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

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
        onPointerMove={followPointer}
        onPointerLeave={recentre}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 print:hidden">
          {MONOGRAM_LAYERS.map((layer) => (
            <MonogramLayer key={layer.app} {...layer} px={px} py={py} />
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
