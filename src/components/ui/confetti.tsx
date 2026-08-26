"use client";

import type { ReactNode } from "react";
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { Button } from "~/components/ui/button";

export interface ConfettiOptions {
  particleCount?: number;
  spread?: number;
  origin?: { x?: number; y?: number };
  colors?: string[];
}

export type ConfettiRef = {
  fire: (options?: ConfettiOptions) => void;
} | null;

interface Props extends React.ComponentPropsWithRef<"canvas"> {
  options?: ConfettiOptions;
  manualstart?: boolean;
  children?: ReactNode;
}

const DEFAULT_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

function runParticleBurst(canvas: HTMLCanvasElement, opts: ConfettiOptions = {}) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const count = opts.particleCount ?? 50;
  const colors = opts.colors ?? DEFAULT_COLORS;
  const originX = (opts.origin?.x ?? 0.5) * canvas.width;
  const originY = (opts.origin?.y ?? 0.5) * canvas.height;

  interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    color: string;
    alpha: number;
    rotation: number;
    vRot: number;
  }

  const particles: Particle[] = Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 6;
    return {
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3,
      size: 4 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)] ?? "#3b82f6",
      alpha: 1,
      rotation: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 10,
    };
  });

  // oxlint-disable-next-line eslint/no-unused-vars
  let animId: number;
  const render = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let activeCount = 0;

    for (const p of particles) {
      if (p.alpha <= 0) continue;
      activeCount++;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15; // gravity
      p.alpha -= 0.015;
      p.rotation += p.vRot;

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }

    if (activeCount > 0) {
      animId = requestAnimationFrame(render);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  animId = requestAnimationFrame(render);
}

export const Confetti = forwardRef<ConfettiRef, Props>((props, ref) => {
  const { options, manualstart = false, children, ...rest } = props;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const fire = useCallback(
    (opts: ConfettiOptions = {}) => {
      const canvas = canvasRef.current;
      if (canvas) {
        runParticleBurst(canvas, { ...options, ...opts });
      }
    },
    [options]
  );

  useImperativeHandle(ref, () => ({ fire }), [fire]);

  useEffect(() => {
    if (!manualstart) {
      fire();
    }
  }, [manualstart, fire]);

  return (
    <>
      <canvas ref={canvasRef} {...rest} />
      {children}
    </>
  );
});

Confetti.displayName = "Confetti";

interface ConfettiButtonProps extends React.ComponentProps<"button"> {
  options?: ConfettiOptions;
}

// oxlint-disable-next-line eslint/no-unused-vars
export const ConfettiButton = ({ options, children, ...props }: ConfettiButtonProps) => {
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    props.onClick?.(event);
  };

  return (
    <Button onClick={handleClick} {...props}>
      {children}
    </Button>
  );
};

ConfettiButton.displayName = "ConfettiButton";
