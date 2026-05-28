"use client";

import { cn } from "~/lib/utils";

interface DistortedGlassProps {
  className?: string;
  children?: React.ReactNode;
  asBackground?: boolean;
  asOverlay?: boolean;
}

export const DistortedGlass = ({
  className,
  children,
  asBackground = false,
  asOverlay = false,
}: DistortedGlassProps) => {
  const isOverlay = asOverlay || (!asBackground && !children);
  const zClass = isOverlay ? "z-20" : "-z-10";

  if (asBackground || asOverlay || !children) {
    return (
      <>
        <div
          className={cn(
            "pointer-events-none absolute inset-0 overflow-hidden rounded-xl border border-white/10",
            zClass,
            className
          )}
        >
          <div className="glass-effect absolute -inset-[20px]"></div>
        </div>
        <style jsx>{`
          .glass-effect {
            background: rgba(255, 255, 255, 0.02);
            background: repeating-radial-gradient(
              circle at 50% 50%,
              rgba(255, 255, 255, 0) 0px,
              rgba(255, 255, 255, 0.06) 8px,
              rgba(255, 255, 255, 0.12) 16px
            );
            filter: url(#fractal-noise-glass);
            background-size: 5px 5px;
            backdrop-filter: blur(4px);
          }
          :global(.dark) .glass-effect {
            background: rgba(0, 0, 0, 0.15);
            background: repeating-radial-gradient(
              circle at 50% 50%,
              rgba(255, 255, 255, 0) 0px,
              rgba(255, 255, 255, 0.02) 8px,
              rgba(255, 255, 255, 0.04) 16px
            );
          }
        `}</style>
      </>
    );
  }

  return (
    <>
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-white/10 p-4 shadow-sm",
          className
        )}
      >
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-xl">
          <div className="glass-effect absolute -inset-[20px]"></div>
        </div>
        <div className="relative z-10">{children}</div>
      </div>

      <style jsx>{`
        .glass-effect {
          background: rgba(255, 255, 255, 0.02);
          background: repeating-radial-gradient(
            circle at 50% 50%,
            rgba(255, 255, 255, 0) 0px,
            rgba(255, 255, 255, 0.06) 8px,
            rgba(255, 255, 255, 0.12) 16px
          );
          filter: url(#fractal-noise-glass);
          background-size: 5px 5px;
          backdrop-filter: blur(4px);
        }
        :global(.dark) .glass-effect {
          background: rgba(0, 0, 0, 0.15);
          background: repeating-radial-gradient(
            circle at 50% 50%,
            rgba(255, 255, 255, 0) 0px,
            rgba(255, 255, 255, 0.02) 8px,
            rgba(255, 255, 255, 0.04) 16px
          );
        }
      `}</style>
    </>
  );
};
