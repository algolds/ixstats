import * as React from "react";
import { cn } from "~/lib/utils";
import { SunLight as Sun, HalfMoon as Moon, Sparks as Sparkles, Bug } from "iconoir-react";
import { type LabConfig, type BgStyleType } from "./types";
import { LabTemplates } from "./LabTemplates";
import { useTheme } from "~/context/theme-context";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";

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
        ? "border-separator bg-surface text-label"
        : "border-separator bg-surface-secondary text-label";
    case "gradient":
      return isDark ? "border-separator text-label" : "border-separator text-label";
    case "solid":
      return isDark ? "border-separator text-label" : "border-separator text-label";
    case "pattern":
      return isDark
        ? "border-separator bg-surface text-label"
        : "border-separator bg-surface-secondary text-label";
    case "none":
      return isDark
        ? "border-transparent bg-transparent text-label"
        : "border-transparent bg-transparent text-label";
  }
}

function renderBackdrop(style: BgStyleType, theme: "light" | "dark", customColor: string) {
  const _gridColor = theme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)";
  const textColor = theme === "dark" ? "opacity-25" : "opacity-20";

  switch (style) {
    case "refraction":
      return (
        <>
          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-50 select-none">
            <div className="bg-indigo/25 absolute -top-16 -left-16 h-48 w-48 rounded-full blur-3xl" />
            <div className="bg-pink/20 absolute top-1/4 -right-16 h-56 w-56 rounded-full blur-3xl" />
            <div className="bg-teal/20 absolute -bottom-16 left-1/3 h-64 w-64 rounded-full blur-3xl" />

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
                "text-eyebrow absolute inset-0 flex flex-col items-center justify-between px-6 py-12 font-mono",
                textColor
              )}
            >
              <div className="flex rotate-3 gap-20">
                <span>Facet UI Engine</span>
                <span>1.1.0 Ogma</span>
              </div>
              <div className="text-caption flex -rotate-3 gap-12">
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
  const { effectiveTheme, setTheme } = useTheme();

  // Keep the exported snippet's theme in step with the real appearance.
  React.useEffect(() => {
    if (simulatedTheme !== effectiveTheme) onChange({ simulatedTheme: effectiveTheme });
  }, [effectiveTheme, simulatedTheme, onChange]);

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
    // oxlint-disable-next-line
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
    // oxlint-disable-next-line
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
    <Card className="flex flex-1 flex-col gap-4 p-6">
      <div className="border-separator flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="text-tint h-4 w-4" />
          <h3 className="text-headline">Sandbox preview</h3>
        </div>
        {/* Previews follow the app appearance: Facet roles switch on html[data-theme]. */}
        <SegmentedControl
          size="sm"
          aria-label="Appearance"
          value={effectiveTheme}
          onValueChange={(value) => {
            setTheme(value);
            onChange({ simulatedTheme: value });
          }}
          options={[
            { value: "light", label: "Light", icon: <Sun /> },
            { value: "dark", label: "Dark", icon: <Moon /> },
          ]}
        />
      </div>

      {/* Live Interactive Rendering Canvas */}
      <div
        className={cn(
          "rounded-row duration-fast relative flex min-h-[360px] items-center justify-center overflow-hidden border p-12 transition-colors",
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
              className="pointer-events-none absolute z-0 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-500 select-none"
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
              className="pointer-events-none absolute z-0 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-500 select-none"
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
              className="pointer-events-none absolute z-20 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-500 select-none"
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
              className="pointer-events-none absolute z-20 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-500 select-none"
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
      <Button
        variant={showDebug ? "secondary" : "secondary"}
        size="sm"
        aria-pressed={showDebug}
        onClick={() => setShowDebug(!showDebug)}
        className="self-end"
      >
        <Bug />
        {showDebug ? "Hide CSS Debug" : "CSS Debug"}
      </Button>

      {/* Debug panel */}
      {showDebug && (
        <div className="bg-surface-secondary rounded-row text-footnote space-y-2 p-4 font-mono leading-relaxed">
          <div className="text-label-secondary text-subhead border-separator mb-2 flex items-center gap-2 border-b pb-2 font-sans">
            <Bug className="h-3 w-3" />
            Computed CSS
            <span className="text-label-tertiary ml-auto font-normal normal-case">live</span>
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            {[
              ["Classes", generatedClassNames],
              ["Depth", `facet-depth-${depth}`],
              ["Material", `facet-material-${material}`],
            ].map(([label, val]) => (
              <React.Fragment key={label}>
                <span className="text-label-secondary">{label}</span>
                <span className="text-label truncate" title={val}>
                  {val}
                </span>
              </React.Fragment>
            ))}
          </div>
          <div className="border-separator border-t pt-2">
            <div className="text-label-secondary text-subhead mb-1 font-sans">Computed styles</div>
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
              {Object.entries(computed).map(([prop, val]) => (
                <React.Fragment key={prop}>
                  <span className="text-label-secondary truncate">{prop}</span>
                  <span
                    className="text-label truncate font-normal"
                    title={val}
                    style={{
                      color:
                        val === "none" || val === "not set"
                          ? "var(--color-destructive)"
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
    </Card>
  );
}
