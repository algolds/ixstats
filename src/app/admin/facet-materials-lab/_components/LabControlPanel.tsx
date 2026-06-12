import * as React from "react";
import { type TextureType } from "~/components/ui/texture-overlay";
import { Slider } from "~/components/ui/slider";
import { Switch } from "~/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Sliders, GlassWater, Sun, Palette } from "lucide-react";
import { ColorPicker } from "~/components/ui/color-picker";
import {
  type LabConfig,
  type MaterialType,
  type VariantType,
  type InteractivityType,
  type TemplateType,
  type BgStyleType,
} from "./types";

interface LabControlPanelProps {
  config: LabConfig;
  onChange: (updates: Partial<LabConfig>) => void;
}

export function LabControlPanel({ config, onChange }: LabControlPanelProps) {
  // Synchronize texture defaults when material changes
  React.useEffect(() => {
    const defaults: Record<MaterialType, { text: TextureType; opacity: number }> = {
      satin: { text: "diagonal", opacity: 0.02 },
      paper: { text: "paperGrain", opacity: 0.07 },
      rubber: { text: "dots", opacity: 0.03 },
      metal: { text: "horizontalLines", opacity: 0.04 },
      glass: { text: "scatteredDots", opacity: 0.015 },
      carbon: { text: "woven", opacity: 0.08 },
      wood: { text: "waves", opacity: 0.06 },
    };
    const currentDefaults = defaults[config.material];
    onChange({
      texture: currentDefaults.text,
      textureOpacity: currentDefaults.opacity,
    });
  }, [config.material, onChange]);

  return (
    <div className="bg-card/45 border-border/40 rounded-2xl border p-6 backdrop-blur-md">
      <div className="border-border/20 mb-6 flex items-center gap-2 border-b pb-3">
        <Sliders className="text-primary h-4 w-4" />
        <h3 className="text-sm font-semibold tracking-wide uppercase">Simulation Controls</h3>
      </div>

      <div className="space-y-6">
        {/* ── Template Selection ── */}
        <div className="space-y-2">
          <label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Template Selection
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: "material-block", label: "Material Block" },
              { id: "facet-card", label: "Facet Card" },
              { id: "facet-button", label: "Facet Button" },
              { id: "compounding-stack", label: "Nesting Blur Stack" },
              { id: "facet-navigation", label: "Facet Navigation" },
              { id: "enhanced-card", label: "Enhanced Card" },
              { id: "bento-card", label: "Bento Grid Card" },
              { id: "progressive-blur", label: "Progressive Blur" },
              { id: "glare-card", label: "Glare Card" },
              { id: "cutout-card", label: "Cutout Card" },
              { id: "comet-card", label: "Comet Card" },
              { id: "texture-card", label: "Texture Card" },
              { id: "health-rings", label: "Health Rings" },
              { id: "glass-button", label: "Glass Button" },
              { id: "brand-header", label: "Brand Header" },
              { id: "gradient-metrics", label: "Gradient Metrics" },
              { id: "code-block", label: "Code Block" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => onChange({ template: t.id as TemplateType })}
                className={
                  "rounded-lg border px-2.5 py-2 text-center text-[10px] font-semibold transition-all " +
                  (config.template === t.id
                    ? "bg-primary border-primary text-primary-foreground shadow-sm"
                    : "bg-muted/30 border-border/40 hover:bg-muted/65 text-muted-foreground hover:text-foreground")
                }
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Material & Depth ── */}
        <div className="border-border/10 space-y-4 border-t pt-4">
          <div className="flex items-center gap-1.5">
            <GlassWater className="text-primary h-3 w-3" />
            <h4 className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
              Material & Depth
            </h4>
          </div>

          <div className="space-y-2">
            <label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Base Material Type
            </label>
            <Select
              value={config.material}
              onValueChange={(val) => onChange({ material: val as MaterialType })}
            >
              <SelectTrigger className="bg-background/50 border-border/40 w-full rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="satin" description="Frosted glass backing with dynamic sheen">
                  Satin (Glass)
                </SelectItem>
                <SelectItem value="paper" description="Warm matte surface with tactile displacement cast shadow">
                  Paper (Matte Warm)
                </SelectItem>
                <SelectItem value="rubber" description="High-friction chamfered dark plate with deep soft shadow">
                  Rubber (Matte Dark)
                </SelectItem>
                <SelectItem value="metal" description="Metallic brushed layout with linear reflections">
                  Metal (Brushed Steel)
                </SelectItem>
                <SelectItem value="glass" description="Clear heavy glass with prismatic edge glow">
                  Glass (Clear Heavy)
                </SelectItem>
                <SelectItem value="carbon" description="Dark woven carbon fiber weave texture">
                  Carbon Fiber
                </SelectItem>
                <SelectItem value="wood" description="Warm wood grain with rich brown tones">
                  Wood (Grained)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                Elevation Depth
              </label>
              <span className="text-primary font-mono text-xs font-bold">Level {config.depth}</span>
            </div>
            <Slider
              min={1}
              max={4}
              step={1}
              value={[config.depth]}
              onValueChange={(val) => onChange({ depth: val[0] ?? 2 })}
              className="py-2"
            />
            <div className="text-muted-foreground/80 flex justify-between px-0.5 text-[10px]">
              <span>Flat (1)</span>
              <span>Floating (2)</span>
              <span>Overlay (3)</span>
              <span>Modal (4)</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Variant Theme
            </label>
            <Select
              value={config.variant}
              onValueChange={(val) => onChange({ variant: val as VariantType })}
            >
              <SelectTrigger className="bg-background/50 border-border/40 w-full rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="base">Default Base Theme</SelectItem>
                <SelectItem value="mycountry">MyCountry Theme (Amber)</SelectItem>
                <SelectItem value="global">Global Theme (Blue)</SelectItem>
                <SelectItem value="overview">Overview Theme (Indigo)</SelectItem>
                <SelectItem value="economy">Economy Theme (Emerald)</SelectItem>
                <SelectItem value="military">Military Theme (Red)</SelectItem>
                <SelectItem value="cultural">Cultural Theme (Purple)</SelectItem>
                <SelectItem value="security">Security Theme (Blue)</SelectItem>
                <SelectItem value="builder">Builder Theme (Orange)</SelectItem>
                <SelectItem value="forum">Forum Theme (Orange)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Texture ── */}
        <div className="border-border/10 space-y-3 border-t pt-4">
          <div className="flex items-center gap-1.5">
            <Palette className="text-primary h-3 w-3" />
            <h4 className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
              Texture
            </h4>
          </div>

          <div className="space-y-2">
            <label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Tactile Texture Overlay
            </label>
            <Select
              value={config.texture}
              onValueChange={(val) => onChange({ texture: val as TextureType })}
            >
              <SelectTrigger className="bg-background/50 border-border/40 w-full rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (Smooth Glass)</SelectItem>
                <SelectItem value="dots">Dots Pattern</SelectItem>
                <SelectItem value="grid">Grid Mesh</SelectItem>
                <SelectItem value="noise">Gaussian Noise</SelectItem>
                <SelectItem value="crosshatch">Crosshatch</SelectItem>
                <SelectItem value="diagonal">Fine Diagonal Lines</SelectItem>
                <SelectItem value="scatteredDots">Scattered Dots</SelectItem>
                <SelectItem value="halftone">Halftone Print</SelectItem>
                <SelectItem value="triangular">Triangles Grid</SelectItem>
                <SelectItem value="chevron">Tactile Chevron</SelectItem>
                <SelectItem value="paperGrain">Organic Paper Grain</SelectItem>
                <SelectItem value="horizontalLines">Horizontal Brushed</SelectItem>
                <SelectItem value="verticalLines">Vertical Brushed</SelectItem>
                <SelectItem value="waves" description="Concentric wave ring pattern">Waves</SelectItem>
                <SelectItem value="zigzag" description="Alternating zigzag lines">Zigzag</SelectItem>
                <SelectItem value="woven" description="Cross-woven fabric texture">Woven</SelectItem>
                <SelectItem value="brick" description="Offset brick wall pattern">Brick</SelectItem>
                <SelectItem value="herringbone" description="Herringbone chevron pattern">Herringbone</SelectItem>
                <SelectItem value="shimmer" description="Animated shimmer sweep">Shimmer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                Texture Intensity
              </label>
              <span className="text-primary font-mono text-xs font-bold">
                {(config.textureOpacity * 100).toFixed(1)}%
              </span>
            </div>
            <Slider
              min={0}
              max={20}
              step={0.5}
              value={[config.textureOpacity * 100]}
              onValueChange={(val) => onChange({ textureOpacity: (val[0] ?? 5) / 100 })}
              className="py-2"
            />
          </div>

          {config.texture !== "none" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  Pattern Scale
                </label>
                <span className="text-primary font-mono text-xs font-bold">
                  {config.patternScale}%
                </span>
              </div>
              <Slider
                min={50}
                max={200}
                step={5}
                value={[config.patternScale]}
                onValueChange={(val) => onChange({ patternScale: val[0] ?? 100 })}
                className="py-2"
              />
            </div>
          )}
        </div>

        {/* ── Glass & Refraction ── */}
        <div className="border-border/10 space-y-3 border-t pt-4">
          <div className="flex items-center gap-1.5">
            <GlassWater className="h-3 w-3" style={{ color: config.customAccent }} />
            <h4 className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
              Glass & Refraction
            </h4>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                Backdrop Blur
              </label>
              <span className="text-primary font-mono text-xs font-bold">{config.blurStrength}px</span>
            </div>
            <Slider
              min={0}
              max={40}
              step={1}
              value={[config.blurStrength]}
              onValueChange={(val) => onChange({ blurStrength: val[0] ?? 16 })}
              className="py-2"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                Saturation Boost
              </label>
              <span className="text-primary font-mono text-xs font-bold">{config.saturationBoost}%</span>
            </div>
            <Slider
              min={100}
              max={300}
              step={10}
              value={[config.saturationBoost]}
              onValueChange={(val) => onChange({ saturationBoost: val[0] ?? 180 })}
              className="py-2"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-foreground text-xs font-semibold">
                Edge Refraction
              </span>
              <span className="text-muted-foreground text-[10px]">
                Gradient sheen at material borders
              </span>
            </div>
            <Switch
              checked={config.refractionEnabled}
              onCheckedChange={(val) => onChange({ refractionEnabled: val })}
            />
          </div>
        </div>

        {/* ── Glow & Shadow ── */}
        <div className="border-border/10 space-y-3 border-t pt-4">
          <div className="flex items-center gap-1.5">
            <Sun className="h-3 w-3" style={{ color: config.customAccent }} />
            <h4 className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
              Glow & Shadow
            </h4>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                Glow Intensity
              </label>
              <span className="text-primary font-mono text-xs font-bold">{config.glowIntensity}%</span>
            </div>
            <Slider
              min={0}
              max={100}
              step={5}
              value={[config.glowIntensity]}
              onValueChange={(val) => onChange({ glowIntensity: val[0] ?? 50 })}
              className="py-2"
            />
          </div>
        </div>

        {/* ── Depth of Field ── */}
        <div className="border-border/10 space-y-3 border-t pt-4">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold tracking-wider uppercase" style={{ color: config.customAccent }}>
              Depth of Field
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                Fore/Background Shift
              </label>
              <span className="text-primary font-mono text-xs font-bold">{config.dofStrength}%</span>
            </div>
            <Slider
              min={0}
              max={100}
              step={5}
              value={[config.dofStrength]}
              onValueChange={(val) => onChange({ dofStrength: val[0] ?? 0 })}
              className="py-2"
            />
            <p className="text-muted-foreground text-[9px]">
              Moves foreground content forward and background elements backward to visualize depth layering.
            </p>
          </div>
        </div>

        {/* ── Background ── */}
        <div className="border-border/10 space-y-3 border-t pt-4">
          <div className="flex items-center gap-1.5">
            <Palette className="h-3 w-3" style={{ color: config.customAccent }} />
            <h4 className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
              Sandbox Background
            </h4>
          </div>

          <div className="space-y-2">
            <label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Background Style
            </label>
            <Select
              value={config.bgStyle}
              onValueChange={(val) => onChange({ bgStyle: val as BgStyleType })}
            >
              <SelectTrigger className="bg-background/50 border-border/40 w-full rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="refraction">Refraction Blobs + Grid</SelectItem>
                <SelectItem value="gradient">Gradient Wash</SelectItem>
                <SelectItem value="solid">Solid Color</SelectItem>
                <SelectItem value="pattern">Pattern Tiles</SelectItem>
                <SelectItem value="none">Clean (No Backdrop)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {config.bgStyle !== "refraction" && (
            <div className="space-y-2">
              <label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                Background Color
              </label>
              <ColorPicker
                color={config.bgCustomColor}
                onChange={(color) => onChange({ bgCustomColor: color })}
              />
            </div>
          )}
        </div>

        {/* ── Interactivity ── */}
        <div className="border-border/10 space-y-3 border-t pt-4">
          <div className="space-y-2">
            <label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Interactivity Profile
            </label>
            <Select
              value={config.interactivity}
              onValueChange={(val) => onChange({ interactivity: val as InteractivityType })}
            >
              <SelectTrigger className="bg-background/50 border-border/40 w-full rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Static (No Hover Effects)</SelectItem>
                <SelectItem value="interactive">Interactive Hover Scale & Shadows</SelectItem>
                <SelectItem value="hierarchy-interactive">
                  Hierarchical Stack Interactive (Saturate + Hover)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Toggles ── */}
        <div className="border-border/10 space-y-3 border-t pt-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-foreground text-xs font-semibold">
                Pointer Light Interactions
              </span>
              <span className="text-muted-foreground text-[10px]">
                Radial reflection gradient follows mouse coordinates
              </span>
            </div>
            <Switch
              checked={config.lightInteraction}
              onCheckedChange={(val) => onChange({ lightInteraction: val })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
