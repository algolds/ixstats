import * as React from "react";
import { cn } from "~/lib/utils";
import { Sun, Moon, Sparkles, Bug } from "lucide-react";
import { type LabConfig, type BgStyleType } from "./types";
import { LabTemplates } from "./LabTemplates";

interface LabSandboxProps {
  config: LabConfig;
  onChange: (updates: Partial<LabConfig>) => void;
  generatedClassNames: string;
}

function getBgClasses(style: BgStyleType, theme: "light" | "dark") {
  const isDark = theme === "dark";
  switch (style) {
    case "refraction":
      return isDark
        ? "dark border-zinc-800 bg-zinc-950 text-white"
        : "light border-zinc-200 bg-zinc-50 text-zinc-900";
    case "gradient":
      return isDark ? "dark border-zinc-800 text-white" : "light border-zinc-200 text-zinc-900";
    case "solid":
      return isDark ? "dark border-zinc-800 text-white" : "light border-zinc-200 text-zinc-900";
    case "pattern":
      return isDark
        ? "dark border-zinc-800 bg-zinc-950 text-white"
        : "light border-zinc-200 bg-zinc-50 text-zinc-900";
    case "none":
      return isDark
        ? "dark border-transparent bg-transparent text-white"
        : "light border-transparent bg-transparent text-zinc-900";
  }
}

function renderBackdrop(style: BgStyleType, theme: "light" | "dark", customColor: string) {
  // eslint-disable-next-line unused-imports/no-unused-vars
  const gridColor = theme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)";
  const textColor = theme === "dark" ? "opacity-25" : "opacity-20";

  switch (style) {
    case "refraction":
      return (
        <>
          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-50 select-none">
            <div className="absolute -top-16 -left-16 h-48 w-48 rounded-full bg-indigo-500/25 blur-3xl" />
            <div className="absolute top-1/4 -right-16 h-56 w-56 rounded-full bg-pink-500/20 blur-3xl" />
            <div className="absolute -bottom-16 left-1/3 h-64 w-64 rounded-full bg-teal-500/20 blur-3xl" />

            <div
              className={cn(
                "absolute inset-0 bg-[linear-gradient(to_right,var(--grid-color)_1px,transparent_1px),linear-gradient(to_bottom,var(--grid-color)_1px,transparent_1px)] bg-[size:20px_20px]",
                theme === "dark"
                  ? "[--grid-color:rgba(255,255,255,0.04)]"
                  : "[--grid-color:rgba(0,0,0,0.04)]"
              )}
            />

            <div
              className={cn(
                "absolute inset-0 flex flex-col items-center justify-between px-6 py-12 font-mono text-[9px] tracking-widest uppercase",
                textColor
              )}
            >
              <div className="flex rotate-3 gap-20">
                <span>Facet UI Engine</span>
                <span>1.0.2 Ogma</span>
              </div>
              <div className="flex -rotate-3 gap-12 text-xs font-bold">
                <span>Tactile Shading Grid</span>
                <span>Optic Refraction Field</span>
              </div>
              <div className="flex rotate-2 gap-20">
                <span>Next.js 16</span>
                <span>Tailwind 4</span>
              </div>
            </div>
          </div>
        </>
      );

    case "gradient":
      return (
        <div
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background: `linear-gradient(135deg, ${customColor}44, ${customColor}11, transparent 70%)`,
          }}
        />
      );

    case "solid":
      return (
        <div
          className="pointer-events-none absolute inset-0 z-0"
          style={{ backgroundColor: `${customColor}22` }}
        />
      );

    case "pattern":
      return (
        <div
          className="pointer-events-none absolute inset-0 z-0 opacity-[0.07]"
          style={{
            backgroundImage: `radial-gradient(circle, ${customColor} 1px, transparent 1px)`,
            backgroundSize: "20px 20px",
          }}
        />
      );

    case "none":
      return null;

    default:
      return null;
  }
}

export function LabSandbox({ config, onChange, generatedClassNames }: LabSandboxProps) {
  const {
    simulatedTheme,
    lightInteraction,
    template,
    bgStyle,
    bgCustomColor,
    depth,
    material,
    blurStrength,
    saturationBoost,
    glowIntensity,
    refractionEnabled,
    dofStrength,
  } = config;

  const [showDebug, setShowDebug] = React.useState(false);

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

  // Poll computed styles for debug panel
  const [computed, setComputed] = React.useState<Record<string, string>>({});
  const rafRef = React.useRef<number>(0);

  React.useEffect(() => {
    if (!showDebug) {
      cancelAnimationFrame(rafRef.current);
      return;
    }
    const el = previewRef.current;
    if (!el) return;

    const poll = () => {
      const style = getComputedStyle(el);
      setComputed({
        "backdrop-filter": style.backdropFilter || (style as any).webkitBackdropFilter || "none",
        "box-shadow": style.boxShadow,
        background: style.background,
        "z-index": style.zIndex,
        transform: style.transform,
        "border-radius": style.borderRadius,
        "--blur-moderate": style.getPropertyValue("--blur-moderate") || "not set",
        "--facet-saturate": style.getPropertyValue("--facet-saturate") || "not set",
        "--facet-glow-opacity": style.getPropertyValue("--facet-glow-opacity") || "not set",
        "--pointer-x": style.getPropertyValue("--pointer-x") || "not set",
      });
      rafRef.current = requestAnimationFrame(poll);
    };
    rafRef.current = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafRef.current);
  }, [
    showDebug,
    template,
    depth,
    material,
    blurStrength,
    saturationBoost,
    glowIntensity,
    refractionEnabled,
  ]);

  const dynamicStyles: React.CSSProperties = {
    "--pointer-x": pointerState.x,
    "--pointer-y": pointerState.y,
    "--pointer-offset-x": pointerState.offsetX,
    "--pointer-offset-y": pointerState.offsetY,
    "--facet-lab-blur": `${config.blurStrength}px`,
    "--facet-lab-saturate": `${config.saturationBoost}%`,
    "--facet-saturate": `${config.saturationBoost}%`,
    "--facet-lab-glow": `${config.glowIntensity / 100}`,
    "--facet-lab-pattern-scale": `${config.patternScale}%`,
    "--facet-lab-accent": config.customAccent,
    "--blur-moderate": `${config.blurStrength}px`,
    "--blur-prominent": `${Math.min(config.blurStrength + 8, 40)}px`,
    "--blur-intense": `${Math.min(config.blurStrength + 16, 48)}px`,
    "--blur-subtle": `${Math.max(config.blurStrength - 8, 0)}px`,
    "--facet-glow-opacity": `${config.glowIntensity / 100}`,
    "--facet-dof": `${config.dofStrength}`,
  } as React.CSSProperties;

  return (
    <div className="bg-card/45 border-border/40 flex flex-1 flex-col gap-4 rounded-2xl border p-6 backdrop-blur-md">
      <div className="border-border/20 flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="text-primary h-4 w-4" />
          <h3 className="text-sm font-semibold tracking-wide uppercase">
            Simulated Sandbox Preview
          </h3>
        </div>
        <div className="bg-muted/40 border-border/20 flex items-center gap-1.5 rounded-lg border p-0.5">
          <button
            onClick={() => onChange({ simulatedTheme: "light" })}
            className={cn(
              "flex items-center gap-1.5 rounded-md p-1.5 text-xs font-semibold transition-all",
              simulatedTheme === "light"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Sun className="h-3.5 w-3.5" />
            <span>Light</span>
          </button>
          <button
            onClick={() => onChange({ simulatedTheme: "dark" })}
            className={cn(
              "flex items-center gap-1.5 rounded-md p-1.5 text-xs font-semibold transition-all",
              simulatedTheme === "dark"
                ? "bg-background text-foreground shadow-xs"
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
          "relative flex min-h-[360px] items-center justify-center overflow-hidden rounded-xl border p-12 transition-all duration-350",
          getBgClasses(bgStyle, simulatedTheme)
        )}
        style={
          bgStyle === "gradient" || bgStyle === "solid"
            ? { backgroundColor: bgCustomColor }
            : undefined
        }
      >
        {/* Backdrop layers */}
        {renderBackdrop(bgStyle, simulatedTheme, bgCustomColor)}

        {/* Depth of Field — decorative layer shifts */}
        {dofStrength > 0 && (
          <>
            {/* Background element — shifts backward with depth */}
            <div
              className="pointer-events-none absolute z-[2] transition-all duration-500 select-none"
              style={{
                top: `${15 - dofStrength * 0.08}%`,
                left: `${10 - dofStrength * 0.05}%`,
                width: `${40 + dofStrength * 0.3}px`,
                height: `${40 + dofStrength * 0.3}px`,
                borderRadius: "9999px",
                background:
                  simulatedTheme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                border: `1px solid ${simulatedTheme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
                filter: `blur(${dofStrength * 0.15}px)`,
                opacity: Math.max(0, 0.5 - dofStrength * 0.004),
                transform: `translateZ(${-dofStrength * 0.5}px)`,
              }}
            />
            <div
              className="pointer-events-none absolute z-[2] transition-all duration-500 select-none"
              style={{
                bottom: `${12 - dofStrength * 0.06}%`,
                right: `${8 - dofStrength * 0.04}%`,
                width: `${56 + dofStrength * 0.4}px`,
                height: `${20 + dofStrength * 0.2}px`,
                borderRadius: "8px",
                background:
                  simulatedTheme === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)",
                border: `1px solid ${simulatedTheme === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}`,
                filter: `blur(${dofStrength * 0.12}px)`,
                opacity: Math.max(0, 0.6 - dofStrength * 0.005),
                transform: `translateZ(${-dofStrength * 0.4}px)`,
              }}
            />

            {/* Foreground element — shifts forward with depth */}
            <div
              className="pointer-events-none absolute z-[15] transition-all duration-500 select-none"
              style={{
                top: `${75 + dofStrength * 0.05}%`,
                left: `${80 + dofStrength * 0.08}%`,
                width: `${32 + dofStrength * 0.5}px`,
                height: `${32 + dofStrength * 0.5}px`,
                borderRadius: "9999px",
                background: `${config.customAccent}15`,
                border: `1px solid ${config.customAccent}30`,
                filter: `blur(${Math.max(0, 4 - dofStrength * 0.04)}px)`,
                opacity: Math.min(1, 0.3 + dofStrength * 0.006),
                transform: `translateZ(${dofStrength * 0.8}px)`,
                boxShadow: `0 0 ${dofStrength * 0.5}px ${config.customAccent}20`,
              }}
            />
            <div
              className="pointer-events-none absolute z-[15] transition-all duration-500 select-none"
              style={{
                top: `${20 - dofStrength * 0.03}%`,
                right: `${5 + dofStrength * 0.06}%`,
                width: `${20 + dofStrength * 0.3}px`,
                height: `${20 + dofStrength * 0.3}px`,
                borderRadius: "4px",
                background: `${config.customAccent}10`,
                border: `1px solid ${config.customAccent}25`,
                transform: `translateZ(${dofStrength * 0.6}px) rotate(${dofStrength * 0.3}deg)`,
                opacity: Math.min(1, 0.2 + dofStrength * 0.005),
              }}
            />
          </>
        )}

        {/* Configured Interactive Component */}
        <div className="relative z-10 flex w-full max-w-sm items-center justify-center">
          <LabTemplates
            config={config}
            previewRef={previewRef}
            dynamicStyles={dynamicStyles}
            generatedClassNames={generatedClassNames}
          />
        </div>
      </div>

      {/* Debug toggle */}
      <button
        onClick={() => setShowDebug(!showDebug)}
        className={cn(
          "flex items-center gap-1.5 self-end rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition-all",
          showDebug
            ? "bg-primary border-primary text-primary-foreground"
            : "bg-muted/30 border-border/40 hover:bg-muted/65 text-muted-foreground hover:text-foreground"
        )}
      >
        <Bug className="h-3 w-3" />
        {showDebug ? "Hide CSS Debug" : "CSS Debug"}
      </button>

      {/* Debug panel */}
      {showDebug && (
        <div className="bg-background/80 border-border/20 space-y-2 rounded-xl border p-4 font-mono text-[10px] leading-relaxed backdrop-blur-sm">
          <div className="text-muted-foreground mb-1.5 flex items-center gap-2 border-b pb-1.5 text-[9px] font-bold tracking-wider uppercase">
            <Bug className="h-3 w-3" />
            Computed CSS
            <span className="text-muted-foreground/50 ml-auto font-normal normal-case">live</span>
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            {[
              ["Classes", generatedClassNames],
              ["Depth", `facet-depth-${depth}`],
              ["Material", `facet-material-${material}`],
            ].map(([label, val]) => (
              <React.Fragment key={label}>
                <span className="text-muted-foreground">{label}</span>
                <span className="text-foreground truncate" title={val}>
                  {val}
                </span>
              </React.Fragment>
            ))}
          </div>
          <div className="border-border/10 border-t pt-1.5">
            <div className="text-muted-foreground mb-1 text-[9px] font-semibold tracking-wider uppercase">
              Computed Styles
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
              {Object.entries(computed).map(([prop, val]) => (
                <React.Fragment key={prop}>
                  <span className="text-muted-foreground truncate">{prop}</span>
                  <span
                    className="text-foreground truncate font-normal"
                    title={val}
                    style={{
                      color:
                        val === "none" || val === "not set"
                          ? "var(--color-error, #ef4444)"
                          : undefined,
                      fontStyle: val === "not set" ? "italic" : undefined,
                    }}
                  >
                    {val.length > 60 ? `${val.slice(0, 58)}…` : val}
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
