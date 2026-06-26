"use client";

import { useMemo, useRef, useEffect } from "react";
import { cn } from "~/lib/utils";

interface OnomaDoubleHelixIconProps {
  className?: string;
  isHovered?: boolean;
}

// Base-pair characters representing various conlang families and IPA transcription
const CHARACTERS = ["ə", "Ω", "文", "A", "ʃ", "ñ", "あ", "ð", "θ", "λ", "汉", "ß"];

export function OnomaDoubleHelixIcon({ className, isHovered = false }: OnomaDoubleHelixIconProps) {
  const startY = 20;
  const endY = 180;
  const amplitude = 36;
  const period = 100; // Pixels for one full wave cycle
  const centerX = 100;
  const steps = 60;

  // 1. Dynamic DOM references for high-performance direct manipulation
  const pathARef = useRef<SVGPathElement>(null);
  const pathBRef = useRef<SVGPathElement>(null);
  const rungElements = useRef<Record<number, {
    lineLeft: SVGLineElement | null;
    lineRight: SVGLineElement | null;
    circleLeft: SVGCircleElement | null;
    circleRight: SVGCircleElement | null;
    text: SVGTextElement | null;
    group: SVGGElement | null;
  }>>({});

  // 2. Generate points for initial static render (so it mounts instantly without layout shift)
  const { pathA, pathB, rungs } = useMemo(() => {
    const pointsA: string[] = [];
    const pointsB: string[] = [];
    const tempRungs: { y: number; x1: number; x2: number; char: string }[] = [];

    for (let i = 0; i <= steps; i++) {
      const y = startY + (i / steps) * (endY - startY);
      const angle = ((y - startY) / period) * 2 * Math.PI;
      const xOffset = Math.sin(angle) * amplitude;
      const x1 = centerX + xOffset;
      const x2 = centerX - xOffset;

      pointsA.push(`${x1.toFixed(1)},${y.toFixed(1)}`);
      pointsB.push(`${x2.toFixed(1)},${y.toFixed(1)}`);
    }

    const rungIntervals = [35, 68, 100, 132, 165];
    rungIntervals.forEach((y, idx) => {
      const angle = ((y - startY) / period) * 2 * Math.PI;
      const xOffset = Math.sin(angle) * amplitude;
      const x1 = centerX + xOffset;
      const x2 = centerX - xOffset;
      const char = CHARACTERS[idx % CHARACTERS.length];
      tempRungs.push({ y, x1, x2, char });
    });

    return {
      pathA: `M ${pointsA.join(" L ")}`,
      pathB: `M ${pointsB.join(" L ")}`,
      rungs: tempRungs,
    };
  }, [startY, endY, steps, amplitude, period, centerX]);

  // Keep a mutable ref of the hover state to avoid restarting the animation loop
  const isHoveredRef = useRef(isHovered);
  useEffect(() => {
    isHoveredRef.current = isHovered;
  }, [isHovered]);

  // 3. Direct DOM requestAnimationFrame loop
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const phaseRef = useRef<number>(0);
  const speedRef = useRef<number>(1.2);

  useEffect(() => {
    const tick = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const deltaTime = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1); // Cap delta to prevent huge jumps
      lastTimeRef.current = timestamp;

      // Smoothly transition (lerp) speed based on hover state
      const targetSpeed = isHoveredRef.current ? 2.8 : 1.2;
      speedRef.current += (targetSpeed - speedRef.current) * 0.08;
      phaseRef.current += speedRef.current * deltaTime;

      const phase = phaseRef.current;

      // Update Strand A and B paths
      const pointsA: string[] = [];
      const pointsB: string[] = [];
      for (let i = 0; i <= steps; i++) {
        const y = startY + (i / steps) * (endY - startY);
        const angle = ((y - startY) / period) * 2 * Math.PI + phase;
        const xOffset = Math.sin(angle) * amplitude;
        const x1 = centerX + xOffset;
        const x2 = centerX - xOffset;

        pointsA.push(`${x1.toFixed(1)},${y.toFixed(1)}`);
        pointsB.push(`${x2.toFixed(1)},${y.toFixed(1)}`);
      }

      if (pathARef.current) pathARef.current.setAttribute("d", `M ${pointsA.join(" L ")}`);
      if (pathBRef.current) pathBRef.current.setAttribute("d", `M ${pointsB.join(" L ")}`);

      // Update Rungs
      rungs.forEach((rung, idx) => {
        const angle = ((rung.y - startY) / period) * 2 * Math.PI + phase;
        const xOffset = Math.sin(angle) * amplitude;
        const x1 = centerX + xOffset;
        const x2 = centerX - xOffset;

        const isLeftToRight = x1 < x2;
        const leftX = isLeftToRight ? x1 : x2;
        const rightX = isLeftToRight ? x2 : x1;

        const width = rightX - leftX;
        const elMap = rungElements.current[idx];

        if (elMap) {
          if (width < 35) {
            // Hide elements when strands cross to prevent crowded text/badge overlap
            if (elMap.group) elMap.group.style.display = "none";
          } else {
            if (elMap.group) elMap.group.style.display = "";
            if (elMap.lineLeft) {
              elMap.lineLeft.setAttribute("x1", leftX.toFixed(1));
              elMap.lineLeft.setAttribute("x2", "87");
            }
            if (elMap.lineRight) {
              elMap.lineRight.setAttribute("x1", "113");
              elMap.lineRight.setAttribute("x2", rightX.toFixed(1));
            }
            if (elMap.circleLeft) elMap.circleLeft.setAttribute("cx", leftX.toFixed(1));
            if (elMap.circleRight) elMap.circleRight.setAttribute("cx", rightX.toFixed(1));
          }
        }
      });

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [rungs, startY, endY, steps, period, amplitude, centerX]);

  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-full h-full text-[#0091ff]", className)}
    >
      <defs>
        {/* Glow Filters */}
        <filter id="glow-heavy" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="glow-light" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        {/* Drop shadow for key badges */}
        <filter id="key-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.08" />
        </filter>

        {/* Gradient for strands */}
        <linearGradient id="strand-grad-1" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--color-primary, #0091ff)" stopOpacity="0.5" />
          <stop offset="50%" stopColor="var(--color-primary, #0091ff)" stopOpacity="0.95" />
          <stop offset="100%" stopColor="var(--color-primary, #0091ff)" stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id="strand-grad-2" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.4" />
          <stop offset="50%" stopColor="#4f46e5" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.4" />
        </linearGradient>
      </defs>

      {/* Rungs (Base-pairs with characters inside keycaps) */}
      <g className="rungs-group">
        {rungs.map((rung, idx) => {
          const isLeftToRight = rung.x1 < rung.x2;
          const leftX = isLeftToRight ? rung.x1 : rung.x2;
          const rightX = isLeftToRight ? rung.x2 : rung.x1;

          return (
            <g
              key={idx}
              ref={(el) => {
                if (!rungElements.current[idx]) rungElements.current[idx] = {} as any;
                rungElements.current[idx].group = el;
              }}
              className="transition-all duration-300 opacity-90 hover:opacity-100"
            >
              {/* Connector Rung Left */}
              <line
                ref={(el) => {
                  if (rungElements.current[idx]) rungElements.current[idx].lineLeft = el;
                }}
                x1={leftX}
                y1={rung.y}
                x2="87"
                y2={rung.y}
                stroke="currentColor"
                strokeWidth="1.5"
                className="stroke-[#0091ff]/35 dark:stroke-[#0091ff]/30"
              />
              
              {/* Connector Rung Right */}
              <line
                ref={(el) => {
                  if (rungElements.current[idx]) rungElements.current[idx].lineRight = el;
                }}
                x1="113"
                y1={rung.y}
                x2={rightX}
                y2={rung.y}
                stroke="currentColor"
                strokeWidth="1.5"
                className="stroke-[#0091ff]/35 dark:stroke-[#0091ff]/30"
              />

              {/* Rung Nodes at Connection Points */}
              <circle
                ref={(el) => {
                  if (rungElements.current[idx]) rungElements.current[idx].circleLeft = el;
                }}
                cx={leftX}
                cy={rung.y}
                r="3.5"
                className="fill-[#0091ff]"
                filter="url(#glow-light)"
              />
              <circle
                ref={(el) => {
                  if (rungElements.current[idx]) rungElements.current[idx].circleRight = el;
                }}
                cx={rightX}
                cy={rung.y}
                r="3.5"
                className="fill-indigo-500"
                filter="url(#glow-light)"
              />

              {/* Apple-style Squircle Key Badge */}
              <rect
                x="87"
                y={rung.y - 13}
                width="26"
                height="26"
                rx="7"
                ry="7"
                className="fill-white dark:fill-[#0c0e14] stroke-[#0091ff]/20 dark:stroke-[#0091ff]/40 shadow-sm"
                strokeWidth="1.5"
                filter="url(#key-shadow)"
              />

              {/* Linguistic/Phonetic base character */}
              <text
                ref={(el) => {
                  if (rungElements.current[idx]) rungElements.current[idx].text = el;
                }}
                x="100"
                y={rung.y + 4.5}
                textAnchor="middle"
                className="fill-neutral-900 dark:fill-neutral-100 font-sans font-black select-none text-[13px]"
              >
                {rung.char}
              </text>
            </g>
          );
        })}
      </g>

      {/* Helix Backbone Strand A */}
      <path
        ref={pathARef}
        d={pathA}
        fill="none"
        stroke="url(#strand-grad-1)"
        strokeWidth="4.5"
        strokeLinecap="round"
        className="opacity-80 dark:opacity-90"
        filter="url(#glow-light)"
      />

      {/* Helix Backbone Strand B */}
      <path
        ref={pathBRef}
        d={pathB}
        fill="none"
        stroke="url(#strand-grad-2)"
        strokeWidth="4"
        strokeLinecap="round"
        className="opacity-70 dark:opacity-80"
        filter="url(#glow-light)"
      />
    </svg>
  );
}

export default OnomaDoubleHelixIcon;
