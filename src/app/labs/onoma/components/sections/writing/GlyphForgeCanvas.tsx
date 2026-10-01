// src/app/labs/onoma/components/sections/writing/GlyphForgeCanvas.tsx
// Onoma Lab — Tactile Glyph Designer & Vector Canvas
// Philosophy: Apple SF Symbols × Emil Design Engineering × Pro Audio/Vector Studio

import React, { useState, useRef, useEffect, useCallback } from "react";
// oxlint-disable-next-line eslint/no-unused-vars
import {
  Undo as Undo2,
  Redo as Redo2,
  Undo as RotateCcw,
  Component as Shapes,
  Plus,
  ViewGrid as Grid3X3,
  Check,
  EditPencil as PenTool,
  Sparks as Sparkle,
} from "iconoir-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { cn } from "~/lib/utils";
import type { Glyph, CanvasGuideSettings, InkColorPreset } from "./types";
import { SHAPE_STAMPS, QUICK_IPA_PHONEMES, type ShapeStamp } from "./glyph-primitives";
import { Input } from "~/components/ui/input";
import { FacetCard } from "~/components/ui/facet-container";

const CANVAS_DRAFT_KEY = "onoma_glyph_canvas_draft_v2";

interface GlyphForgeCanvasProps {
  onSaveGlyph: (phoneme: string, svgPath: string, unicode?: string) => void;
  editingGlyph?: Glyph | null;
  onCancelEdit?: () => void;
  existingGlyphs: Glyph[];
}

const INK_PRESETS: Record<
  InkColorPreset,
  { label: string; stroke: string; glow: string; bg: string }
> = {
  accent: {
    label: "Onoma blue",
    stroke: "var(--tint)",
    glow: "color-mix(in srgb, var(--tint) 35%, transparent)",
    bg: "bg-tint",
  },
  mono: {
    label: "Ink black",
    stroke: "currentColor",
    glow: "color-mix(in srgb, currentColor 15%, transparent)",
    bg: "bg-label",
  },
  indigo: {
    label: "Indigo",
    stroke: "var(--color-indigo)",
    glow: "color-mix(in srgb, var(--color-indigo) 30%, transparent)",
    bg: "bg-indigo",
  },
  emerald: {
    label: "Emerald",
    stroke: "var(--color-green)",
    glow: "color-mix(in srgb, var(--color-green) 30%, transparent)",
    bg: "bg-green",
  },
  ruby: {
    label: "Ruby",
    stroke: "var(--color-red)",
    glow: "color-mix(in srgb, var(--color-red) 30%, transparent)",
    bg: "bg-red",
  },
  violet: {
    label: "Cyan",
    stroke: "var(--color-teal)",
    glow: "color-mix(in srgb, var(--color-teal) 30%, transparent)",
    bg: "bg-teal",
  },
};

const STROKE_WIDTH_OPTIONS = [
  { label: "Thin", value: 3, lineH: 1.5 },
  { label: "Regular", value: 5.5, lineH: 3 },
  { label: "Bold", value: 8, lineH: 4.5 },
  { label: "Heavy", value: 12, lineH: 6 },
];

export function GlyphForgeCanvas({
  onSaveGlyph,
  editingGlyph,
  onCancelEdit,
  existingGlyphs,
}: GlyphForgeCanvasProps) {
  const shouldReduceMotion = useReducedMotion();

  // Multi-stroke drawing history
  const [strokes, setStrokes] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[][]>([]);

  // Current active stroke during drawing
  const [currentStroke, setCurrentStroke] = useState<string>("");
  const [_isDrawing, setIsDrawing] = useState(false);

  // Styling & Tools
  const [strokeWidth, setStrokeWidth] = useState<number>(5.5);
  const [inkColor, setInkColor] = useState<InkColorPreset>("accent");
  const [showStampDrawer, setShowStampDrawer] = useState(false);
  const [showIpaDrawer, setShowIpaDrawer] = useState(false);

  // Typographic Guides
  const [guides, setGuides] = useState<CanvasGuideSettings>({
    showGrid: true,
    guideLevel: "all",
    showOpticalCircle: true,
    showCrosshairs: true,
    snapToGrid: false,
  });

  // Inputs
  const [grapheme, setGrapheme] = useState("");
  const [unicodeSymbol, setUnicodeSymbol] = useState("");

  const canvasRef = useRef<SVGSVGElement | null>(null);
  const activePathRef = useRef<string>("");
  const isDrawingRef = useRef<boolean>(false);
  const lastEditingGlyphRef = useRef<string | null>(null);

  // Load in-progress draft from localStorage on initial mount (if not editing an existing glyph)
  useEffect(() => {
    if (!editingGlyph) {
      try {
        const savedDraft = localStorage.getItem(CANVAS_DRAFT_KEY);
        if (savedDraft) {
          const parsed = JSON.parse(savedDraft);
          if (Array.isArray(parsed.strokes) && parsed.strokes.length > 0) {
            setStrokes(parsed.strokes);
          }
          if (parsed.grapheme) setGrapheme(parsed.grapheme);
          if (parsed.unicodeSymbol) setUnicodeSymbol(parsed.unicodeSymbol);
          if (parsed.strokeWidth) setStrokeWidth(parsed.strokeWidth);
          if (parsed.inkColor) setInkColor(parsed.inkColor);
        }
      } catch (err) {
        console.warn("Failed to restore canvas draft:", err);
      }
    }
  }, [editingGlyph]);

  // Persist in-progress canvas draft to localStorage
  useEffect(() => {
    if (!editingGlyph) {
      try {
        localStorage.setItem(
          CANVAS_DRAFT_KEY,
          JSON.stringify({
            strokes,
            grapheme,
            unicodeSymbol,
            strokeWidth,
            inkColor,
          })
        );
      } catch (err) {
        console.warn("Failed to persist canvas draft:", err);
      }
    }
  }, [strokes, grapheme, unicodeSymbol, strokeWidth, inkColor, editingGlyph]);

  // Sync when editing an existing glyph
  useEffect(() => {
    if (editingGlyph && editingGlyph.id !== lastEditingGlyphRef.current) {
      lastEditingGlyphRef.current = editingGlyph.id;
      setGrapheme(editingGlyph.phoneme);
      setUnicodeSymbol(editingGlyph.unicode || "");
      if (editingGlyph.svgPath) {
        const parts = editingGlyph.svgPath
          .trim()
          .split(/(?=M\s*)/i)
          .filter(Boolean);
        setStrokes(parts.length > 0 ? parts : [editingGlyph.svgPath]);
      } else {
        setStrokes([]);
      }
      setRedoStack([]);
    } else if (!editingGlyph && lastEditingGlyphRef.current !== null) {
      lastEditingGlyphRef.current = null;
    }
  }, [editingGlyph]);

  // Coordinate normalizer (0..128 SVG space)
  const getCanvasCoords = useCallback(
    (e: React.PointerEvent<SVGSVGElement>): { x: number; y: number } => {
      if (!canvasRef.current) return { x: 64, y: 64 };
      const rect = canvasRef.current.getBoundingClientRect();
      const rawX = ((e.clientX - rect.left) / rect.width) * 128;
      const rawY = ((e.clientY - rect.top) / rect.height) * 128;

      let x = Math.round(Math.max(0, Math.min(128, rawX)));
      let y = Math.round(Math.max(0, Math.min(128, rawY)));

      if (guides.snapToGrid) {
        x = Math.round(x / 8) * 8;
        y = Math.round(y / 8) * 8;
      }

      return { x, y };
    },
    [guides.snapToGrid]
  );

  // Pointer Event Handlers for 1:1 fluid tracking
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    setIsDrawing(true);
    const { x, y } = getCanvasCoords(e);
    activePathRef.current = `M ${x} ${y} L ${x} ${y}`;
    setCurrentStroke(activePathRef.current);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawingRef.current) return;
    const { x, y } = getCanvasCoords(e);
    activePathRef.current += ` L ${x} ${y}`;
    setCurrentStroke(activePathRef.current);
  };

  const handlePointerUp = (e?: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    setIsDrawing(false);
    if (e && canvasRef.current) {
      try {
        canvasRef.current.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
    const finalStroke = activePathRef.current.trim();
    if (finalStroke) {
      setStrokes((prev) => [...prev, finalStroke]);
      setRedoStack([]);
    }
    activePathRef.current = "";
    setCurrentStroke("");
  };

  const handlePointerCancel = (e: React.PointerEvent<SVGSVGElement>) => {
    handlePointerUp(e);
  };

  // Undo / Redo / Clear
  const handleUndo = () => {
    if (strokes.length === 0) return;
    const last = strokes[strokes.length - 1];
    setRedoStack((prev) => [...prev, [last]]);
    setStrokes((prev) => prev.slice(0, -1));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const lastRedo = redoStack[redoStack.length - 1];
    setStrokes((prev) => [...prev, ...lastRedo]);
    setRedoStack((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (strokes.length > 0) {
      setRedoStack((prev) => [...prev, strokes]);
      setStrokes([]);
      activePathRef.current = "";
      setCurrentStroke("");
      try {
        localStorage.removeItem(CANVAS_DRAFT_KEY);
      } catch {
        // ignore
      }
    }
  };

  // Stamp a geometric shape
  const handleApplyStamp = (stamp: ShapeStamp) => {
    setStrokes((prev) => [...prev, stamp.path]);
    setRedoStack([]);
    setShowStampDrawer(false);
  };

  // Save / Add Glyph
  const handleForge = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const key = grapheme.trim().toLowerCase();
    if (!key) return;
    const fullPath = strokes.join(" ").trim();
    if (!fullPath) return;

    onSaveGlyph(key, fullPath, unicodeSymbol.trim() || undefined);

    if (!editingGlyph) {
      setGrapheme("");
      setUnicodeSymbol("");
      setStrokes([]);
      setRedoStack([]);
      try {
        localStorage.removeItem(CANVAS_DRAFT_KEY);
      } catch {
        // ignore
      }
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          handleForge();
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleForge();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const activeInk = INK_PRESETS[inkColor];
  const isExisting = Boolean(
    existingGlyphs.some((g) => g.phoneme.toLowerCase() === grapheme.trim().toLowerCase())
  );

  return (
    <FacetCard variant="inset" padding="none" className="relative flex flex-col space-y-3 p-4">
      {/* 1. Apple-Style Header: Studio Badge & History Tools */}
      <div className="border-separator flex items-center justify-between gap-2 border-b pb-2.5">
        <div className="flex items-center gap-2">
          <div className="bg-tint/10 text-tint rounded-control flex h-6 w-6 items-center justify-center">
            <PenTool className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="text-label text-footnote font-semibold">
                {editingGlyph ? `Refining ⟨${editingGlyph.phoneme}⟩` : "Glyph Designer"}
              </h4>
              {strokes.length > 0 && (
                <span className="text-label-secondary bg-fill-3 py-0.2 text-caption rounded-full px-1.5 font-mono">
                  {strokes.length}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Top Control Cluster */}
        <div className="flex items-center gap-1.5">
          {editingGlyph && onCancelEdit && (
            <button
              type="button"
              onClick={onCancelEdit}
              className="text-label-secondary hover:text-label hover:bg-fill-3 rounded-control-sm text-caption cursor-pointer px-2 py-0.5 font-medium transition-colors active:scale-95"
            >
              Cancel
            </button>
          )}

          {/* History Group */}
          <div className="border-separator bg-fill-4 rounded-control flex items-center gap-0.5 border p-0.5">
            <button
              type="button"
              onClick={handleUndo}
              disabled={strokes.length === 0}
              title="Undo (Cmd+Z)"
              className="text-label-secondary hover:text-label hover:bg-surface rounded-control-sm flex h-5.5 w-5.5 cursor-pointer items-center justify-center transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-90 disabled:opacity-25"
            >
              <Undo2 className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              title="Redo (Cmd+Shift+Z)"
              className="text-label-secondary hover:text-label hover:bg-surface rounded-control-sm flex h-5.5 w-5.5 cursor-pointer items-center justify-center transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-90 disabled:opacity-25"
            >
              <Redo2 className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={strokes.length === 0 && !currentStroke}
              title="Clear Canvas"
              className="text-label-secondary rounded-control-sm hover:bg-red/10 hover:text-red flex h-5.5 w-5.5 cursor-pointer items-center justify-center transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-90 disabled:opacity-25"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          </div>

          {/* Guide Overlay Toggle */}
          <button
            type="button"
            onClick={() =>
              setGuides((g) => ({
                ...g,
                guideLevel:
                  g.guideLevel === "all"
                    ? "baseline"
                    : g.guideLevel === "baseline"
                      ? "none"
                      : "all",
              }))
            }
            title={`Guide View: ${guides.guideLevel}`}
            className={cn(
              "rounded-control text-caption flex h-6.5 cursor-pointer items-center gap-1 border px-2 font-medium transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-95",
              guides.guideLevel !== "none"
                ? "border-tint/30 bg-tint/10 text-tint"
                : "border-separator bg-fill-4 text-label-secondary hover:text-label"
            )}
          >
            <Grid3X3 className="h-3 w-3" />
            <span className="capitalize">
              {guides.guideLevel === "all" ? "Guides" : guides.guideLevel}
            </span>
          </button>
        </div>
      </div>

      {/* 2. Premium Vector Drawing Canvas (SF Symbols Style Hairlines) */}
      <div className="border-separator bg-surface rounded-card relative flex aspect-square w-full items-center justify-center overflow-hidden border shadow-inner select-none">
        <svg
          ref={canvasRef}
          viewBox="0 0 128 128"
          className="h-full w-full cursor-crosshair touch-none select-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        >
          <defs>
            <pattern id="forge-grid" width="16" height="16" patternUnits="userSpaceOnUse">
              <path
                d="M 16 0 L 0 0 0 16"
                fill="none"
                stroke="currentColor"
                className="text-label-quaternary"
                strokeWidth="0.5"
              />
            </pattern>
          </defs>

          {/* Background Grid Pattern */}
          {guides.showGrid && guides.guideLevel !== "none" && (
            <rect width="128" height="128" fill="url(#forge-grid)" />
          )}

          {/* Typographic Metric Reference Hairlines (Monochromatic & Elegant) */}
          {guides.guideLevel === "all" && (
            <>
              {/* Ascender line (y=20) */}
              <line
                x1="0"
                y1="20"
                x2="128"
                y2="20"
                stroke="currentColor"
                className="text-label-quaternary"
                strokeWidth="0.75"
                strokeDasharray="2 3"
              />
              <text
                x="3"
                y="18"
                fill="currentColor"
                fontSize="6"
                className="text-label-quaternary font-mono font-medium select-none"
              >
                asc
              </text>

              {/* Cap height (y=36) */}
              <line
                x1="0"
                y1="36"
                x2="128"
                y2="36"
                stroke="currentColor"
                className="text-label-quaternary"
                strokeWidth="0.75"
                strokeDasharray="2 3"
              />
              <text
                x="3"
                y="34"
                fill="currentColor"
                fontSize="6"
                className="text-label-quaternary font-mono font-medium select-none"
              >
                cap
              </text>

              {/* Mean line / X-Height (y=56) */}
              <line
                x1="0"
                y1="56"
                x2="128"
                y2="56"
                stroke="currentColor"
                className="text-label-quaternary"
                strokeWidth="0.75"
                strokeDasharray="2 3"
              />
              <text
                x="3"
                y="54"
                fill="currentColor"
                fontSize="6"
                className="text-label-quaternary font-mono font-medium select-none"
              >
                x
              </text>

              {/* Descender line (y=112) */}
              <line
                x1="0"
                y1="112"
                x2="128"
                y2="112"
                stroke="currentColor"
                className="text-label-quaternary"
                strokeWidth="0.75"
                strokeDasharray="2 3"
              />
              <text
                x="3"
                y="110"
                fill="currentColor"
                fontSize="6"
                className="text-label-quaternary font-mono font-medium select-none"
              >
                desc
              </text>
            </>
          )}

          {/* Baseline (Primary Metric) */}
          {guides.guideLevel !== "none" && (
            <>
              <line
                x1="0"
                y1="92"
                x2="128"
                y2="92"
                className="stroke-tint opacity-40"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <text
                x="3"
                y="90"
                fontSize="6.5"
                className="fill-tint font-mono font-semibold opacity-60 select-none"
              >
                base 92
              </text>
            </>
          )}

          {/* Center Crosshairs & Optical Circle (Subtle Watermark) */}
          {guides.showCrosshairs && guides.guideLevel === "all" && (
            <>
              <line
                x1="64"
                y1="0"
                x2="64"
                y2="128"
                stroke="currentColor"
                className="text-label-quaternary"
                strokeWidth="0.5"
              />
              <line
                x1="0"
                y1="64"
                x2="128"
                y2="64"
                stroke="currentColor"
                className="text-label-quaternary"
                strokeWidth="0.5"
              />
            </>
          )}

          {guides.showOpticalCircle && guides.guideLevel === "all" && (
            <circle
              cx="64"
              cy="64"
              r="44"
              fill="none"
              stroke="currentColor"
              className="text-label-quaternary"
              strokeDasharray="3 3"
              strokeWidth="0.5"
            />
          )}

          {/* Committed Strokes */}
          {strokes.map((pathStr, i) => (
            <path
              key={`stroke-${i}`}
              d={pathStr}
              fill="none"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                stroke: activeInk.stroke,
                filter: `drop-shadow(0 0 2px ${activeInk.glow})`,
              }}
            />
          ))}

          {/* Active In-Progress Stroke */}
          {currentStroke && (
            <path
              d={currentStroke}
              fill="none"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                stroke: activeInk.stroke,
                filter: `drop-shadow(0 0 4px ${activeInk.glow})`,
              }}
            />
          )}
        </svg>
      </div>

      {/* 3. Docked Apple-Style Unified Tool Inspector */}
      <div className="border-separator bg-fill-4 rounded-row flex items-center justify-between gap-1.5 border p-1">
        {/* Stroke Weight Stepper */}
        <div className="flex items-center gap-0.5">
          {STROKE_WIDTH_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => setStrokeWidth(opt.value)}
              title={`${opt.label} Stroke (${opt.value}px)`}
              className={cn(
                "rounded-control flex h-6 cursor-pointer items-center justify-center px-2 transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-90",
                strokeWidth === opt.value
                  ? "bg-background text-label shadow-card font-semibold"
                  : "text-label-secondary hover:text-label hover:bg-surface"
              )}
            >
              <div
                className="rounded-full bg-current"
                style={{ width: opt.lineH * 2.2, height: opt.lineH }}
              />
            </button>
          ))}
        </div>

        <div className="bg-separator h-4 w-px" />

        {/* Ink Color Palette */}
        <div className="flex items-center gap-1 px-1">
          {(Object.keys(INK_PRESETS) as InkColorPreset[]).map((key) => {
            const preset = INK_PRESETS[key];
            const isSelected = inkColor === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setInkColor(key)}
                title={preset.label}
                className={cn(
                  "relative flex h-4.5 w-4.5 cursor-pointer items-center justify-center rounded-full transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-85",
                  preset.bg,
                  isSelected
                    ? "ring-tint ring-offset-surface shadow-card scale-110 ring-2 ring-offset-2"
                    : "opacity-60 hover:scale-105 hover:opacity-100"
                )}
              />
            );
          })}
        </div>

        <div className="bg-separator h-4 w-px" />

        {/* Stamps Drawer Button */}
        <button
          type="button"
          onClick={() => setShowStampDrawer(!showStampDrawer)}
          className={cn(
            "rounded-control text-caption flex h-6 shrink-0 cursor-pointer items-center gap-1 px-2 font-medium transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-95",
            showStampDrawer
              ? "border-tint/40 bg-tint/10 text-tint border"
              : "text-label-secondary hover:text-label hover:bg-surface"
          )}
        >
          <Shapes className="h-3 w-3" />
          <span>Stamps</span>
        </button>
      </div>

      {/* Stamp Primitives Drawer */}
      <AnimatePresence>
        {showStampDrawer && (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="border-separator bg-fill-4 rounded-row overflow-hidden border p-2.5"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-label-secondary text-eyebrow">Geometric Shapes</span>
              <button
                type="button"
                onClick={() => setShowStampDrawer(false)}
                className="text-label-secondary hover:text-label text-caption"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
              {SHAPE_STAMPS.map((stamp) => (
                <button
                  key={stamp.id}
                  type="button"
                  onClick={() => handleApplyStamp(stamp)}
                  title={stamp.description}
                  className="border-separator bg-surface hover:border-tint/50 hover:bg-tint/5 group rounded-control flex cursor-pointer flex-col items-center justify-center border p-1.5 text-center transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-95"
                >
                  <svg
                    viewBox="0 0 128 128"
                    className="stroke-separator group-hover:stroke-tint h-6 w-6 fill-none transition-colors"
                  >
                    <path
                      d={stamp.path}
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="text-label-secondary group-hover:text-label text-caption mt-0.5 line-clamp-1">
                    {stamp.name}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Unified Action Form Bar */}
      <form onSubmit={handleForge} className="space-y-2">
        <div className="flex items-center gap-1.5">
          {/* Grapheme Input with IPA button embedded inside right edge */}
          <div className="relative flex-1">
            <Input
              type="text"
              required
              value={grapheme}
              onChange={(e) => setGrapheme(e.target.value)}
              placeholder="Grapheme (e.g. sh, a)"
              className="text-footnote h-8.5 w-full pr-9 pl-3 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowIpaDrawer(!showIpaDrawer)}
              title="Insert IPA symbol"
              className={cn(
                "rounded-control-sm text-caption absolute top-1/2 right-1.5 -translate-y-1/2 cursor-pointer px-1.5 py-0.5 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform]",
                showIpaDrawer ? "bg-tint/15 text-tint" : "text-label-secondary hover:text-tint"
              )}
            >
              IPA
            </button>
          </div>

          {/* Unicode Point (Optional) */}
          <div className="w-20">
            <Input
              type="text"
              value={unicodeSymbol}
              onChange={(e) => setUnicodeSymbol(e.target.value)}
              placeholder="U+Code"
              className="text-footnote h-8.5 w-full text-center font-mono"
            />
          </div>

          {/* Save / Add Glyph Button */}
          <button
            type="submit"
            disabled={!grapheme.trim() || strokes.length === 0}
            className={cn(
              "rounded-row text-footnote text-on-tint shadow-card flex h-8.5 shrink-0 cursor-pointer items-center justify-center gap-1 px-3.5 font-medium transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-35",
              isExisting ? "bg-tint/90 hover:bg-tint" : "bg-tint hover:bg-tint-hover"
            )}
          >
            {editingGlyph ? (
              <>
                <Check className="h-3 w-3" />
                <span>Update</span>
              </>
            ) : (
              <>
                <Plus className="h-3 w-3" />
                <span>Save</span>
              </>
            )}
          </button>
        </div>

        {/* Quick IPA Helper Strip */}
        <AnimatePresence>
          {showIpaDrawer && (
            <motion.div
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="border-separator bg-fill-4 rounded-row flex flex-wrap items-center gap-1 overflow-hidden border p-2"
            >
              <span className="text-label-secondary text-caption mr-1 font-medium">IPA:</span>
              {QUICK_IPA_PHONEMES.map((item) => (
                <button
                  key={item.symbol}
                  type="button"
                  onClick={() => {
                    setGrapheme(item.symbol);
                    setUnicodeSymbol(item.symbol);
                  }}
                  title={item.name}
                  className="hover:border-tint/40 hover:bg-tint/10 border-separator bg-surface rounded-control-sm text-caption cursor-pointer border px-1.5 py-0.5 font-mono font-semibold transition-colors active:scale-95"
                >
                  {item.symbol}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </FacetCard>
  );
}
