"use client";

// src/app/labs/onoma/components/sections/studio/AcousticFormantVisualizer.tsx
// Onoma Lab — Real-Time IPA Formant & Acoustic Spectrogram Visualizer

import { useState, useMemo, useRef, useEffect } from "react";
import {
  Activity,
  AudioWaveform,
  Sliders,
  Sparkles,
  Info,
  Radio,
  Eye,
} from "lucide-react";
import {
  IPA_VOWEL_FORMANTS,
  CARDINAL_VOWEL_GRID,
  extractVowelsFromIpa,
  f1ToY,
  f2ToX,
  calculateAcousticCenter,
  type VowelFormant,
} from "~/lib/onoma/vowel-formants";
import { cn } from "~/lib/utils";

interface AcousticFormantVisualizerProps {
  currentIpa: string;
  currentName?: string;
  accentColor?: string;
}

export function AcousticFormantVisualizer({
  currentIpa,
  currentName,
  accentColor = "#0091ff",
}: AcousticFormantVisualizerProps) {
  const [activeTab, setActiveTab] = useState<"quadrilateral" | "spectrogram">("quadrilateral");
  const [hoveredVowel, setHoveredVowel] = useState<VowelFormant | null>(null);

  // Extract active vowels from the current word's IPA
  const activeVowels = useMemo(() => {
    return extractVowelsFromIpa(currentIpa);
  }, [currentIpa]);

  const acousticCenter = useMemo(() => {
    return calculateAcousticCenter(activeVowels);
  }, [activeVowels]);

  // Vowel Trajectory Metrics
  const frontnessCount = useMemo(() => {
    const counts = { front: 0, central: 0, back: 0 };
    for (const v of activeVowels) {
      counts[v.category]++;
    }
    return counts;
  }, [activeVowels]);

  // Canvas Spectrogram / Oscilloscope Simulation
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (activeTab !== "spectrogram" || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let phase = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // Background subtle grid
      ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 25) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw Formant Peaks based on active vowels
      const baseFreqs = activeVowels.length > 0
        ? activeVowels.map((v) => ({ f1: v.f1, f2: v.f2 }))
        : [{ f1: 500, f2: 1500 }];

      // Animated Waveform Layer
      ctx.beginPath();
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2;
      ctx.shadowColor = accentColor;
      ctx.shadowBlur = 8;

      const sliceWidth = width / 128;
      let x = 0;

      for (let i = 0; i < 128; i++) {
        const t = i / 128;
        // Sum of harmonics driven by F1 and F2
        let amp = 0;
        baseFreqs.forEach((freq, idx) => {
          const wave1 = Math.sin(t * (freq.f1 / 40) + phase + idx);
          const wave2 = Math.cos(t * (freq.f2 / 100) + phase * 1.5 + idx);
          amp += (wave1 * 0.5 + wave2 * 0.3);
        });

        amp = (amp / Math.max(1, baseFreqs.length)) * (height * 0.28);
        const y = height / 2 + amp;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw FFT Frequency Bars on Bottom
      const barCount = 48;
      const barWidth = (width - 40) / barCount;
      for (let b = 0; b < barCount; b++) {
        const barFreq = (b / barCount) * 3000;
        let barEnergy = 0;

        baseFreqs.forEach((freq) => {
          const dist1 = Math.abs(barFreq - freq.f1);
          const dist2 = Math.abs(barFreq - freq.f2);
          const peak1 = Math.exp(-(dist1 * dist1) / 30000);
          const peak2 = Math.exp(-(dist2 * dist2) / 60000);
          barEnergy = Math.max(barEnergy, peak1 * 0.9 + peak2 * 0.7);
        });

        // Add dynamic shimmer
        const shimmer = (Math.sin(phase * 4 + b * 0.3) + 1) * 0.08;
        const finalH = Math.max(4, (barEnergy + shimmer) * (height * 0.55));
        const barX = 20 + b * barWidth;
        const barY = height - 10 - finalH;

        ctx.fillStyle = b % 2 === 0 ? "rgba(0, 145, 255, 0.4)" : "rgba(139, 92, 246, 0.4)";
        ctx.fillRect(barX, barY, barWidth - 2, finalH);
      }

      phase += 0.04;
      if (document.visibilityState === "visible") {
        animFrameRef.current = requestAnimationFrame(render);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (!animFrameRef.current) {
          animFrameRef.current = requestAnimationFrame(render);
        }
      } else if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    render();

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [activeTab, activeVowels, accentColor]);

  // Quadrilateral chart dimensions
  const svgWidth = 420;
  const svgHeight = 280;
  const pad = 35;

  // Trapezoid boundary points in F1/F2 space:
  // Top-Left: /i/ (F1=250, F2=2500) -> Top-Right: /u/ (F1=250, F2=750)
  // Bottom-Right: /ɑ/ (F1=800, F2=950) -> Bottom-Left: /a/ (F1=800, F2=1600)
  const trapTopLeft = { x: f2ToX(2400, svgWidth, pad), y: f1ToY(250, svgHeight, pad) };
  const trapTopRight = { x: f2ToX(750, svgWidth, pad), y: f1ToY(250, svgHeight, pad) };
  const trapBottomRight = { x: f2ToX(950, svgWidth, pad), y: f1ToY(780, svgHeight, pad) };
  const trapBottomLeft = { x: f2ToX(1650, svgWidth, pad), y: f1ToY(780, svgHeight, pad) };

  const trapezoidPath = `M ${trapTopLeft.x} ${trapTopLeft.y} L ${trapTopRight.x} ${trapTopRight.y} L ${trapBottomRight.x} ${trapBottomRight.y} L ${trapBottomLeft.x} ${trapBottomLeft.y} Z`;

  // Active vowel trajectory polyline points
  const activePoints = activeVowels.map((v) => ({
    x: f2ToX(v.f2, svgWidth, pad),
    y: f1ToY(v.f1, svgHeight, pad),
    vowel: v,
  }));

  const activeTrajectoryPath = activePoints.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, "");

  return (
    <div className="border-border/40 bg-card/30 space-y-4 rounded-2xl border p-4 shadow-sm backdrop-blur-sm sm:p-5">
      {/* Header with Switcher */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="space-y-0.5 text-left">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-[#0091ff]" />
            <h4 className="text-foreground text-sm font-bold tracking-tight">
              Acoustic Phonetics & Formant Space
            </h4>
          </div>
          <p className="text-muted-foreground text-[11px]">
            Real-time vowel height ($F_1$) vs frontness ($F_2$) trajectory and FFT resonance.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="border-border/40 bg-secondary/20 flex items-center gap-1 rounded-lg border p-1">
          <button
            type="button"
            onClick={() => setActiveTab("quadrilateral")}
            className={cn(
              "cursor-pointer rounded-md px-2.5 py-1 text-xs font-semibold transition-all active:scale-95",
              activeTab === "quadrilateral"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            IPA Vowel Quadrilateral
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("spectrogram")}
            className={cn(
              "cursor-pointer rounded-md px-2.5 py-1 text-xs font-semibold transition-all active:scale-95",
              activeTab === "spectrogram"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Acoustic FFT Spectrum
          </button>
        </div>
      </div>

      {/* Main Visualizer Container */}
      {activeTab === "quadrilateral" ? (
        <div className="space-y-3">
          <div className="border-border/30 bg-background/50 relative overflow-hidden rounded-xl border p-2">
            {/* Axis Labels */}
            <div className="text-muted-foreground absolute top-2 left-3 font-mono text-[9px] font-bold tracking-wider uppercase">
              ← Front ($F_2$ High)
            </div>
            <div className="text-muted-foreground absolute top-2 right-3 font-mono text-[9px] font-bold tracking-wider uppercase">
              Back ($F_2$ Low) →
            </div>
            <div className="text-muted-foreground absolute bottom-2 left-3 font-mono text-[9px] font-bold tracking-wider uppercase">
              Close / High ($F_1$ Low) ↑
            </div>
            <div className="text-muted-foreground absolute bottom-2 right-3 font-mono text-[9px] font-bold tracking-wider uppercase">
              ↓ Open / Low ($F_1$ High)
            </div>

            {/* SVG IPA Quadrilateral */}
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="h-auto w-full max-w-[500px] mx-auto select-none"
            >
              {/* Background IPA Trapezoid */}
              <path
                d={trapezoidPath}
                fill="rgba(0, 145, 255, 0.02)"
                stroke="rgba(255, 255, 255, 0.15)"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />

              {/* Central horizontal dividing lines */}
              <line
                x1={f2ToX(2150, svgWidth, pad)}
                y1={f1ToY(420, svgHeight, pad)}
                x2={f2ToX(880, svgWidth, pad)}
                y2={f1ToY(420, svgHeight, pad)}
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth="1"
              />
              <line
                x1={f2ToX(1900, svgWidth, pad)}
                y1={f1ToY(580, svgHeight, pad)}
                x2={f2ToX(920, svgWidth, pad)}
                y2={f1ToY(580, svgHeight, pad)}
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth="1"
              />

              {/* Central vertical dividing line */}
              <line
                x1={f2ToX(1500, svgWidth, pad)}
                y1={f1ToY(250, svgHeight, pad)}
                x2={f2ToX(1300, svgWidth, pad)}
                y2={f1ToY(780, svgHeight, pad)}
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth="1"
              />

              {/* All Cardinal Background Vowels */}
              {CARDINAL_VOWEL_GRID.map((v) => {
                const cx = f2ToX(v.f2, svgWidth, pad);
                const cy = f1ToY(v.f1, svgHeight, pad);
                const isActive = activeVowels.some((av) => av.ipa === v.ipa);

                return (
                  <g
                    key={v.ipa}
                    className="cursor-pointer transition-opacity"
                    onMouseEnter={() => setHoveredVowel(v)}
                    onMouseLeave={() => setHoveredVowel(null)}
                  >
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isActive ? 6 : 3.5}
                      fill={isActive ? accentColor : "rgba(255, 255, 255, 0.2)"}
                      className={cn(
                        "transition-all",
                        isActive && "shadow-lg animate-pulse"
                      )}
                    />
                    <text
                      x={cx + 8}
                      y={cy + 4}
                      fontSize="11"
                      fontFamily="monospace"
                      fontWeight={isActive ? "bold" : "normal"}
                      fill={isActive ? "#38bdf8" : "rgba(255, 255, 255, 0.4)"}
                    >
                      /{v.ipa}/
                    </text>
                  </g>
                );
              })}

              {/* Active Trajectory Line */}
              {activePoints.length > 1 && (
                <path
                  d={activeTrajectoryPath}
                  fill="none"
                  stroke={accentColor}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="opacity-80"
                />
              )}

              {/* Active Vowel Highlight Rings */}
              {activePoints.map((pt, idx) => (
                <g key={idx}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="9"
                    fill="none"
                    stroke={accentColor}
                    strokeWidth="1.5"
                    className="opacity-70 animate-pulse"
                    style={{
                      transformBox: "fill-box",
                      transformOrigin: "center",
                    }}
                  />
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="4"
                    fill="#ffffff"
                  />
                </g>
              ))}

              {/* Acoustic Center Marker */}
              {acousticCenter && activeVowels.length > 0 && (
                <g>
                  <circle
                    cx={f2ToX(acousticCenter.f2, svgWidth, pad)}
                    cy={f1ToY(acousticCenter.f1, svgHeight, pad)}
                    r="5"
                    fill="#ec4899"
                  />
                  <text
                    x={f2ToX(acousticCenter.f2, svgWidth, pad) + 8}
                    y={f1ToY(acousticCenter.f1, svgHeight, pad) - 4}
                    fontSize="9"
                    fontFamily="monospace"
                    fill="#ec4899"
                    fontWeight="bold"
                  >
                    Center of Gravity
                  </text>
                </g>
              )}
            </svg>
          </div>

          {/* Metrics Summary Strip */}
          <div className="grid grid-cols-2 gap-2 text-left sm:grid-cols-4">
            <div className="border-border/30 bg-secondary/10 rounded-lg border p-2">
              <div className="text-muted-foreground text-[10px] uppercase font-bold">
                Active Vowels
              </div>
              <div className="text-foreground font-mono text-xs font-bold">
                {activeVowels.length > 0
                  ? activeVowels.map((v) => `/${v.ipa}/`).join(" ")
                  : "No vowels detected"}
              </div>
            </div>

            <div className="border-border/30 bg-secondary/10 rounded-lg border p-2">
              <div className="text-muted-foreground text-[10px] uppercase font-bold">
                Acoustic Center
              </div>
              <div className="text-[#0091ff] font-mono text-xs font-bold">
                {acousticCenter ? `${acousticCenter.f1}Hz / ${acousticCenter.f2}Hz` : "—"}
              </div>
            </div>

            <div className="border-border/30 bg-secondary/10 rounded-lg border p-2">
              <div className="text-muted-foreground text-[10px] uppercase font-bold">
                Front / Back Ratio
              </div>
              <div className="text-foreground font-mono text-xs font-bold">
                {frontnessCount.front}F · {frontnessCount.central}C · {frontnessCount.back}B
              </div>
            </div>

            <div className="border-border/30 bg-secondary/10 rounded-lg border p-2">
              <div className="text-muted-foreground text-[10px] uppercase font-bold">
                Hovered Formant
              </div>
              <div className="text-emerald-500 font-mono text-xs font-bold">
                {hoveredVowel
                  ? `/${hoveredVowel.ipa}/ (${hoveredVowel.f1}Hz, ${hoveredVowel.f2}Hz)`
                  : "Hover point"}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* FFT Audio Spectrogram Canvas */
        <div className="space-y-3">
          <div className="border-border/30 bg-background/50 relative overflow-hidden rounded-xl border p-2">
            <canvas
              ref={canvasRef}
              width={600}
              height={240}
              className="h-[220px] w-full rounded-lg"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1 font-mono">
            <span>0 Hz (Fundamental $F_0$)</span>
            <span>1500 Hz (Vowel Formant Resonance Band)</span>
            <span>3000 Hz (Fricative / Sibilant Treble)</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default AcousticFormantVisualizer;
