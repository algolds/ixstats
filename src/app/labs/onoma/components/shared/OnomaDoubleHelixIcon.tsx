"use client";

// Onoma Lab — Base Animated branding icon/symbol (OnomaDoubleHelixIcon).
// Matches the selected branding variation: clean, nucleus, crossings, orbit, linear-dna, language-tree, or acoustic-wave.

import { useMemo, useRef, useEffect } from "react";
import { cn } from "~/lib/utils";

interface OnomaDoubleHelixIconProps {
  className?: string;
  isHovered?: boolean;
  variation?: string; // clean | nucleus | crossings | orbit | linear-dna | language-tree | acoustic-wave
  nucleusSymbol?: string; // e.g. "ə"
}

const CHARACTERS = ["ə", "Ω", "文", "A", "ʃ", "ñ", "あ", "ð", "θ", "λ", "汉", "ß"];

export function OnomaDoubleHelixIcon({
  className,
  isHovered = false,
  variation = "crossings",
  nucleusSymbol = "ə",
}: OnomaDoubleHelixIconProps) {
  const startY = 20;
  const endY = 180;
  const amplitude = 36;
  const period = 100; // Pixels for one full wave cycle
  const centerX = 100;
  const steps = 60;

  // dynamic DOM references for the vertical helix animation
  const pathARef = useRef<SVGPathElement>(null);
  const pathBRef = useRef<SVGPathElement>(null);
  const rungElements = useRef<
    Record<
      number,
      {
        lineLeft: SVGLineElement | null;
        lineRight: SVGLineElement | null;
        circleLeft: SVGCircleElement | null;
        circleRight: SVGCircleElement | null;
        text: SVGTextElement | null;
        group: SVGGElement | null;
      }
    >
  >({});

  // Generate initial static points for vertical strand
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

  // Keep ref of hover state
  const isHoveredRef = useRef(isHovered);
  useEffect(() => {
    isHoveredRef.current = isHovered;
  }, [isHovered]);

  // RequestAnimationFrame loop for vertical helix
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const phaseRef = useRef<number>(0);
  const speedRef = useRef<number>(1.2);

  useEffect(() => {
    // Only run double helix animation if using a variation that renders it
    const isHelix = ["clean", "nucleus", "crossings", "orbit", "linear-dna"].includes(variation);
    if (!isHelix) return;

    const tick = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const deltaTime = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = timestamp;

      const targetSpeed = isHoveredRef.current ? 2.8 : 1.2;
      speedRef.current += (targetSpeed - speedRef.current) * 0.08;
      phaseRef.current += speedRef.current * deltaTime;

      const phase = phaseRef.current;

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

        const isMiddleRung = idx === 2;
        const showKeycap = variation === "crossings" || (variation === "nucleus" && isMiddleRung);

        if (elMap) {
          if (width < 35) {
            if (elMap.group) elMap.group.style.display = "none";
          } else {
            if (elMap.group) elMap.group.style.display = "";
            if (!showKeycap) {
              if (elMap.lineLeft) {
                elMap.lineLeft.setAttribute("x1", leftX.toFixed(1));
                elMap.lineLeft.setAttribute("x2", rightX.toFixed(1));
              }
            } else {
              const xGapOffset = variation === "nucleus" && isMiddleRung ? 15 : 13;
              if (elMap.lineLeft) {
                elMap.lineLeft.setAttribute("x1", leftX.toFixed(1));
                elMap.lineLeft.setAttribute("x2", (centerX - xGapOffset).toFixed(1));
              }
              if (elMap.lineRight) {
                elMap.lineRight.setAttribute("x1", (centerX + xGapOffset).toFixed(1));
                elMap.lineRight.setAttribute("x2", rightX.toFixed(1));
              }
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
  }, [rungs, startY, endY, steps, period, amplitude, centerX, variation]);

  // --------------------------------------------------------------------------------
  // Custom Render: Phylogenetic Language Tree
  // --------------------------------------------------------------------------------
  if (variation === "language-tree") {
    return (
      <svg
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn("h-full w-full text-[#0091ff]", className)}
      >
        <g className="tree-branches stroke-current text-[#0091ff] opacity-90">
          <path d="M 100,170 L 100,130" strokeWidth="7" strokeLinecap="round" />
          <path d="M 100,130 L 60,90" strokeWidth="5.5" strokeLinecap="round" />
          <path
            d="M 100,130 L 140,90"
            strokeWidth="5.5"
            strokeLinecap="round"
            className="stroke-indigo-500"
          />
          <path d="M 60,90 L 36,50" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M 60,90 L 84,50" strokeWidth="3.5" strokeLinecap="round" />
          <path
            d="M 140,90 L 116,50"
            strokeWidth="3.5"
            strokeLinecap="round"
            className="stroke-indigo-500"
          />
          <path
            d="M 140,90 L 164,50"
            strokeWidth="3.5"
            strokeLinecap="round"
            className="stroke-indigo-500"
          />
        </g>

        {/* Sound Shift Cladogram Annotations */}
        <g className="sound-shifts fill-current text-[6.5px] font-extrabold text-neutral-400 select-none dark:text-neutral-500">
          <text x="76" y="106" textAnchor="middle">
            *p &gt; f
          </text>
          <text
            x="124"
            y="106"
            textAnchor="middle"
            className="fill-indigo-400 dark:fill-indigo-500"
          >
            *k &gt; x
          </text>
          <text x="44" y="66" textAnchor="middle">
            *t &gt; θ
          </text>
          <text x="76" y="66" textAnchor="middle">
            *s &gt; h
          </text>
          <text x="124" y="66" textAnchor="middle" className="fill-indigo-400 dark:fill-indigo-500">
            *d &gt; t
          </text>
          <text x="156" y="66" textAnchor="middle" className="fill-indigo-400 dark:fill-indigo-500">
            *g &gt; k
          </text>
        </g>

        {[
          { x: 36, y: 50, char: nucleusSymbol || "ə", col: "text-[#0091ff] border-[#0091ff]/20" },
          {
            x: 84,
            y: 50,
            char: nucleusSymbol === "ə" ? "ʃ" : "ə",
            col: "text-[#0091ff] border-[#0091ff]/20",
          },
          { x: 116, y: 50, char: "ð", col: "text-indigo-500 border-indigo-500/20" },
          { x: 164, y: 50, char: "θ", col: "text-indigo-500 border-indigo-500/20" },
          { x: 100, y: 130, char: "Ω", col: "text-[#0091ff] border-[#0091ff]/20" },
        ].map((lf, idx) => (
          <g key={idx}>
            <circle
              cx={lf.x}
              cy={lf.y}
              r="11"
              className="fill-white stroke-[#0091ff]/25 shadow-sm dark:fill-[#0c0e14] dark:stroke-[#0091ff]/45"
              strokeWidth="1.5"
            />
            <text
              x={lf.x}
              y={lf.y + 4}
              textAnchor="middle"
              className={cn(
                "fill-current font-sans text-[11px] font-black select-none",
                lf.col.split(" ")[0]
              )}
            >
              {lf.char}
            </text>
          </g>
        ))}
      </svg>
    );
  }

  // --------------------------------------------------------------------------------
  // Custom Render: Acoustic Soundwave DNA Helix
  // --------------------------------------------------------------------------------
  if (variation === "acoustic-wave") {
    return (
      <svg
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn("h-full w-full text-[#0091ff]", className)}
      >
        <g className="soundwave-bars opacity-25">
          {Array.from({ length: 18 }).map((_, i) => {
            const x = 25 + (i / 17) * 150;
            const norm = i / 17;
            const env = Math.sin(norm * Math.PI) * (Math.sin(norm * 4 * Math.PI) * 0.4 + 0.6);
            const h = 8 + env * 45;
            return (
              <line
                key={i}
                x1={x}
                y1={100 - h}
                x2={x}
                y2={100 + h}
                stroke="currentColor"
                strokeWidth="4.5"
                strokeLinecap="round"
              />
            );
          })}
        </g>
        <path
          d="M 20,100 C 50,45 80,45 110,100 C 140,155 170,155 180,100"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M 20,100 C 50,155 80,155 110,100 C 140,45 170,45 180,100"
          stroke="currentColor"
          strokeWidth="4.5"
          strokeLinecap="round"
          className="stroke-indigo-500"
        />
        {[
          { x: 50, y: 72, char: "ə" },
          { x: 110, y: 100, char: "ʃ" },
          { x: 140, y: 72, char: "ð" },
        ].map((nd, idx) => (
          <g key={idx}>
            <circle
              cx={nd.x}
              cy={nd.y}
              r="11"
              className="fill-white stroke-[#0091ff]/20 shadow-sm dark:fill-[#0c0e14] dark:stroke-[#0091ff]/40"
              strokeWidth="1.5"
            />
            <text
              x={nd.x}
              y={nd.y + 3.5}
              textAnchor="middle"
              className="fill-[#0091ff] font-sans text-[10px] font-bold select-none"
            >
              {nd.char}
            </text>
          </g>
        ))}
      </svg>
    );
  }

  // --------------------------------------------------------------------------------
  // Standard Render: Plasmid & Linear DNA Double Helix variations
  // --------------------------------------------------------------------------------
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-full w-full text-[#0091ff]", className)}
    >
      <defs>
        <filter id="glow-heavy-base" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="glow-light-base" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="key-shadow-base" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow
            dx="0"
            dy="1.5"
            stdDeviation="1.5"
            floodColor="#000000"
            floodOpacity="0.08"
          />
        </filter>
        <linearGradient id="strand-grad-1-base" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--color-primary, #0091ff)" stopOpacity="0.5" />
          <stop offset="50%" stopColor="var(--color-primary, #0091ff)" stopOpacity="0.95" />
          <stop offset="100%" stopColor="var(--color-primary, #0091ff)" stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id="strand-grad-2-base" x1="0%" y1="0%" x2="0%" y2="100%">
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

          const isMiddleRung = idx === 2;
          const showKeycap = variation === "crossings" || (variation === "nucleus" && isMiddleRung);

          const charToShow = variation === "nucleus" && isMiddleRung ? nucleusSymbol : rung.char;
          const rectSize = variation === "nucleus" && isMiddleRung ? 30 : 26;
          const rectX = 100 - rectSize / 2;
          const rectY = rung.y - rectSize / 2;

          return (
            <g
              key={idx}
              ref={(el) => {
                if (!rungElements.current[idx]) rungElements.current[idx] = {} as any;
                rungElements.current[idx].group = el;
              }}
              className="opacity-90 transition-all duration-300 hover:opacity-100"
            >
              {!showKeycap ? (
                <line
                  ref={(el) => {
                    if (rungElements.current[idx]) {
                      rungElements.current[idx].lineLeft = el;
                      rungElements.current[idx].lineRight = null;
                    }
                  }}
                  x1={leftX}
                  y1={rung.y}
                  x2={rightX}
                  y2={rung.y}
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="stroke-[#0091ff]/35 dark:stroke-[#0091ff]/30"
                />
              ) : (
                <>
                  <line
                    ref={(el) => {
                      if (rungElements.current[idx]) rungElements.current[idx].lineLeft = el;
                    }}
                    x1={leftX}
                    y1={rung.y}
                    x2={String(rectX)}
                    y2={rung.y}
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="stroke-[#0091ff]/35 dark:stroke-[#0091ff]/30"
                  />
                  <line
                    ref={(el) => {
                      if (rungElements.current[idx]) rungElements.current[idx].lineRight = el;
                    }}
                    x1={String(rectX + rectSize)}
                    y1={rung.y}
                    x2={rightX}
                    y2={rung.y}
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="stroke-[#0091ff]/35 dark:stroke-[#0091ff]/30"
                  />
                </>
              )}

              {/* Rung Nodes at Connection Points */}
              <circle
                ref={(el) => {
                  if (rungElements.current[idx]) rungElements.current[idx].circleLeft = el;
                }}
                cx={leftX}
                cy={rung.y}
                r="3.5"
                className="fill-[#0091ff]"
                filter="url(#glow-light-base)"
              />
              <circle
                ref={(el) => {
                  if (rungElements.current[idx]) rungElements.current[idx].circleRight = el;
                }}
                cx={rightX}
                cy={rung.y}
                r="3.5"
                className="fill-indigo-500"
                filter="url(#glow-light-base)"
              />

              {/* Apple-style Squircle Key Badge */}
              {showKeycap && (
                <rect
                  x={String(rectX)}
                  y={String(rectY)}
                  width={String(rectSize)}
                  height={String(rectSize)}
                  rx={variation === "nucleus" && isMiddleRung ? "8" : "7"}
                  ry={variation === "nucleus" && isMiddleRung ? "8" : "7"}
                  className="fill-white stroke-[#0091ff]/20 shadow-sm dark:fill-[#0c0e14] dark:stroke-[#0091ff]/40"
                  strokeWidth="1.5"
                  filter="url(#key-shadow-base)"
                />
              )}

              {/* Linguistic/Phonetic base character */}
              {showKeycap && (
                <text
                  ref={(el) => {
                    if (rungElements.current[idx]) rungElements.current[idx].text = el;
                  }}
                  x="100"
                  y={rung.y + (variation === "nucleus" && isMiddleRung ? 5.5 : 4.5)}
                  textAnchor="middle"
                  className={cn(
                    "fill-neutral-900 font-sans font-black select-none dark:fill-neutral-100",
                    variation === "nucleus" && isMiddleRung ? "text-[15px]" : "text-[13px]"
                  )}
                >
                  {charToShow}
                </text>
              )}
            </g>
          );
        })}
      </g>

      {/* Helix Backbone Strand A */}
      <path
        ref={pathARef}
        d={pathA}
        fill="none"
        stroke="url(#strand-grad-1-base)"
        strokeWidth="4.5"
        strokeLinecap="round"
        className="opacity-80 dark:opacity-90"
        filter="url(#glow-light-base)"
      />

      {/* Helix Backbone Strand B */}
      <path
        ref={pathBRef}
        d={pathB}
        fill="none"
        stroke="url(#strand-grad-2-base)"
        strokeWidth="4"
        strokeLinecap="round"
        className="opacity-70 dark:opacity-80"
        filter="url(#glow-light-base)"
      />

      {/* Orbit group */}
      {variation === "orbit" && (
        <g className="orbit-group animate-in fade-in opacity-90 duration-500">
          <circle
            cx="100"
            cy="100"
            r="76"
            stroke="currentColor"
            strokeOpacity="0.15"
            strokeWidth="1"
            strokeDasharray="2,3"
            className="stroke-[#0091ff]"
          />
          {["A", "Ω", "あ", "ش", "ə", "𐦫"].map((sym, index) => {
            const angle = (index / 6) * 2 * Math.PI - Math.PI / 2;
            const x = 100 + 76 * Math.cos(angle);
            const y = 100 + 76 * Math.sin(angle);

            return (
              <g key={sym}>
                <circle
                  cx={x}
                  cy={y}
                  r="9"
                  className="fill-white stroke-[#0091ff]/20 shadow-sm dark:fill-[#0c0e14] dark:stroke-[#0091ff]/40"
                  strokeWidth="0.5"
                />
                <text
                  x={x}
                  y={y + 3}
                  textAnchor="middle"
                  className="fill-[#0091ff] font-sans text-[8px] font-bold select-none"
                >
                  {sym}
                </text>
              </g>
            );
          })}
        </g>
      )}
    </svg>
  );
}

export default OnomaDoubleHelixIcon;
