import * as React from "react";
import { cn } from "~/lib/utils";
import { Sun, Moon, Sparkles } from "lucide-react";
import { type LabConfig } from "./types";
import { LabTemplates } from "./LabTemplates";

interface LabSandboxProps {
  config: LabConfig;
  onChange: (updates: Partial<LabConfig>) => void;
  generatedClassNames: string;
}

export function LabSandbox({ config, onChange, generatedClassNames }: LabSandboxProps) {
  const { simulatedTheme, lightInteraction, template } = config;

  // Real-time pointer coordinates tracker for highlight sheen styles
  const previewRef = React.useRef<HTMLDivElement>(null);
  const [pointerState, setPointerState] = React.useState({
    x: "50%",
    y: "50%",
    offsetX: "0px",
    offsetY: "0px",
  });

  React.useEffect(() => {
    if (!lightInteraction) return;

    const element = previewRef.current;
    if (!element) return;

    let frameId: number;

    const handlePointerMove = (e: PointerEvent) => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        const rect = element.getBoundingClientRect();
        const rawX = e.clientX - rect.left;
        const rawY = e.clientY - rect.top;

        const pctX = Math.max(0, Math.min(100, (rawX / rect.width) * 100));
        const pctY = Math.max(0, Math.min(100, (rawY / rect.height) * 100));

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const maxDisplacement = 8;
        const diffX = ((centerX - rawX) / centerX) * maxDisplacement;
        const diffY = ((centerY - rawY) / centerY) * maxDisplacement;

        const clampX = Math.max(-maxDisplacement, Math.min(maxDisplacement, diffX));
        const clampY = Math.max(-maxDisplacement, Math.min(maxDisplacement, diffY));

        setPointerState({
          x: `${pctX.toFixed(2)}%`,
          y: `${pctY.toFixed(2)}%`,
          offsetX: `${clampX.toFixed(1)}px`,
          offsetY: `${clampY.toFixed(1)}px`,
        });
      });
    };

    const handlePointerLeave = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        setPointerState({
          x: "50%",
          y: "50%",
          offsetX: "0px",
          offsetY: "0px",
        });
      });
    };

    element.addEventListener("pointermove", handlePointerMove);
    element.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      cancelAnimationFrame(frameId);
      element.removeEventListener("pointermove", handlePointerMove);
      element.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [lightInteraction, template]);

  const dynamicStyles: React.CSSProperties = {
    "--pointer-x": pointerState.x,
    "--pointer-y": pointerState.y,
    "--pointer-offset-x": pointerState.offsetX,
    "--pointer-offset-y": pointerState.offsetY,
  } as React.CSSProperties;

  return (
    <div className="bg-card/45 border-border/40 rounded-2xl border p-6 backdrop-blur-md flex flex-col gap-4 flex-1">
      <div className="flex items-center justify-between border-b border-border/20 pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold tracking-wide uppercase">Simulated Sandbox Preview</h3>
        </div>
        <div className="flex items-center gap-1.5 bg-muted/40 p-0.5 rounded-lg border border-border/20">
          <button
            onClick={() => onChange({ simulatedTheme: "light" })}
            className={cn(
              "p-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5",
              simulatedTheme === "light"
                ? "bg-background shadow-xs text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Sun className="h-3.5 w-3.5" />
            <span>Light</span>
          </button>
          <button
            onClick={() => onChange({ simulatedTheme: "dark" })}
            className={cn(
              "p-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5",
              simulatedTheme === "dark"
                ? "bg-background shadow-xs text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Moon className="h-3.5 w-3.5" />
            <span>Dark</span>
          </button>
        </div>
      </div>

      {/* Live Interactive Rendering Canvas */}
      <div
        className={cn(
          "rounded-xl p-12 transition-all duration-350 border relative min-h-[360px] flex items-center justify-center overflow-hidden",
          simulatedTheme === "dark"
            ? "dark bg-zinc-950 text-white border-zinc-800"
            : "light bg-zinc-50 text-zinc-900 border-zinc-200"
        )}
      >
        {/* Colorful backdrop simulation layers (essential for visualizing glass refraction/distortion) */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none opacity-50">
          <div className="absolute -top-16 -left-16 w-48 h-48 rounded-full bg-indigo-500/25 blur-3xl" />
          <div className="absolute top-1/4 -right-16 w-56 h-56 rounded-full bg-pink-500/20 blur-3xl" />
          <div className="absolute -bottom-16 left-1/3 w-64 h-64 rounded-full bg-teal-500/20 blur-3xl" />

          {/* Visual grid backing */}
          <div
            className={cn(
              "absolute inset-0 bg-[linear-gradient(to_right,var(--grid-color)_1px,transparent_1px),linear-gradient(to_bottom,var(--grid-color)_1px,transparent_1px)] bg-[size:20px_20px]",
              simulatedTheme === "dark"
                ? "[--grid-color:rgba(255,255,255,0.04)]"
                : "[--grid-color:rgba(0,0,0,0.04)]"
            )}
          />

          {/* Simulated background items to refract */}
          <div className="absolute inset-0 flex flex-col justify-between items-center py-12 px-6 font-mono text-[9px] uppercase tracking-widest opacity-25">
            <div className="rotate-3 flex gap-20">
              <span>Facet UI Engine</span>
              <span>1.0.2 Ogma</span>
            </div>
            <div className="-rotate-3 flex gap-12 font-bold text-xs">
              <span>Tactile Shading Grid</span>
              <span>Optic Refraction Field</span>
            </div>
            <div className="rotate-2 flex gap-20">
              <span>Next.js 16</span>
              <span>Tailwind 4</span>
            </div>
          </div>
        </div>

        {/* Configured Interactive Component */}
        <div className="relative z-10 w-full max-w-sm flex items-center justify-center">
          <LabTemplates
            config={config}
            previewRef={previewRef}
            dynamicStyles={dynamicStyles}
            generatedClassNames={generatedClassNames}
          />
        </div>
      </div>
    </div>
  );
}
