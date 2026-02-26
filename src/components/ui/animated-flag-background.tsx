"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { cn } from "~/lib/utils";

interface AnimatedFlagBackgroundProps {
  flagUrl?: string;
  className?: string;
  intensity?: "subtle" | "moderate" | "strong";
  blur?: number;
  onLoad?: () => void;
}

const STRIP_WIDTH = 2; // px per vertical slice

const PARAMS = {
  subtle:   { amplitude: 6,  waveLenDiv: 2.5, speed: 0.03, shading: 0.08 },
  moderate: { amplitude: 12, waveLenDiv: 3,   speed: 0.05, shading: 0.12 },
  strong:   { amplitude: 20, waveLenDiv: 3.5, speed: 0.07, shading: 0.18 },
} as const;

export const AnimatedFlagBackground: React.FC<AnimatedFlagBackgroundProps> = ({
  flagUrl,
  className,
  intensity = "moderate",
  blur = 3,
  onLoad,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef(0);
  const timeRef = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0 });
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Resize canvas to match container — only when dimensions change
  const syncSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);
    if (w !== canvas.width || h !== canvas.height) {
      canvas.width = w;
      canvas.height = h;
      sizeRef.current = { w: rect.width, h: rect.height };
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !flagUrl) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const p = PARAMS[intensity];
    let stopped = false;

    // Check reduced motion preference
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Observe container resizing
    const ro = new ResizeObserver(() => syncSize());
    ro.observe(canvas);
    syncSize();

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      if (stopped) return;
      imgRef.current = img;
      onLoad?.();

      // Draw one static frame if reduced motion
      if (prefersReducedMotion) {
        drawFrame(ctx, img, sizeRef.current.w, sizeRef.current.h, p, 0);
        return;
      }

      const loop = () => {
        if (stopped) return;
        timeRef.current += p.speed;
        drawFrame(ctx, img, sizeRef.current.w, sizeRef.current.h, p, timeRef.current);
        animFrameRef.current = requestAnimationFrame(loop);
      };
      animFrameRef.current = requestAnimationFrame(loop);
    };

    img.onerror = () => {
      imgRef.current = null;
    };

    img.src = flagUrl;

    return () => {
      stopped = true;
      cancelAnimationFrame(animFrameRef.current);
      ro.disconnect();
    };
  }, [flagUrl, intensity, syncSize, onLoad]);

  if (!flagUrl) return null;

  return (
    <div className={cn("overflow-hidden", className)}>
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        style={{ filter: blur > 0 ? `blur(${blur}px)` : undefined }}
      />
    </div>
  );
};

/** Draw a single frame of the flag wave animation. */
function drawFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
  p: (typeof PARAMS)[keyof typeof PARAMS],
  time: number,
) {
  if (w === 0 || h === 0) return;

  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const { amplitude, waveLenDiv, shading } = p;
  const wavelength = w / waveLenDiv;
  const numStrips = Math.ceil(w / STRIP_WIDTH) + 1;

  for (let i = 0; i < numStrips; i++) {
    const x = i * STRIP_WIDTH;
    const pct = x / w; // 0 at hoist (left), 1 at fly (right)

    // Vertical sine displacement — amplitude grows from left to right
    const yOffset = Math.sin(x / wavelength - time) * amplitude * pct;

    // Source rectangle from the original image
    const sx = (x / w) * img.width;
    const sw = (STRIP_WIDTH / w) * img.width + 0.5; // +0.5 to avoid sub-pixel gaps

    // Draw the strip at the displaced position
    ctx.drawImage(
      img,
      sx, 0, sw, img.height, // source
      x, yOffset + amplitude, STRIP_WIDTH, h, // destination (offset by amplitude so wave stays in bounds)
    );

    // 3D shading — highlight on upslopes, shadow on downslopes
    const slope = Math.cos(x / wavelength - time) * amplitude * pct;
    if (Math.abs(slope) > 0.5) {
      const alpha = Math.min(Math.abs(slope) / wavelength * shading * 80, shading);
      ctx.fillStyle = slope > 0
        ? `rgba(255,255,255,${alpha})`
        : `rgba(0,0,0,${alpha})`;
      ctx.fillRect(x, yOffset + amplitude, STRIP_WIDTH, h);
    }
  }
}

export default AnimatedFlagBackground;
