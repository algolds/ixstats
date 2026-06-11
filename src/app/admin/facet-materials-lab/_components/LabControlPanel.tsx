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
import { Sliders } from "lucide-react";
import {
  type LabConfig,
  type MaterialType,
  type VariantType,
  type InteractivityType,
  type TemplateType,
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
    };
    const currentDefaults = defaults[config.material];
    onChange({
      texture: currentDefaults.text,
      textureOpacity: currentDefaults.opacity,
    });
  }, [config.material, onChange]);

  return (
    <div className="bg-card/45 border-border/40 rounded-2xl border p-6 backdrop-blur-md">
      <div className="flex items-center gap-2 mb-6 border-b border-border/20 pb-3">
        <Sliders className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold tracking-wide uppercase">Simulation Controls</h3>
      </div>

      <div className="space-y-5">
        {/* Template */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Template Selection
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "material-block", label: "Material Block" },
              { id: "facet-card", label: "Facet Card" },
              { id: "facet-button", label: "Facet Button" },
              { id: "compounding-stack", label: "Nesting Blur Stack" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => onChange({ template: t.id as TemplateType })}
                className={
                  "py-2 px-3 rounded-lg text-xs font-semibold border transition-all text-center " +
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

        {/* Material */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Base Material Type
          </label>
          <Select
            value={config.material}
            onValueChange={(val) => onChange({ material: val as MaterialType })}
          >
            <SelectTrigger className="w-full bg-background/50 border-border/40 rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="satin" description="Frosted glass backing with dynamic sheen">
                Satin (Glass)
              </SelectItem>
              <SelectItem
                value="paper"
                description="Warm matte surface with tactile displacement cast shadow"
              >
                Paper (Matte Warm)
              </SelectItem>
              <SelectItem
                value="rubber"
                description="High-friction chamfered dark plate with deep soft shadow"
              >
                Rubber (Matte Dark)
              </SelectItem>
              <SelectItem
                value="metal"
                description="Metallic brushed layout with linear reflections"
              >
                Metal (Brushed Steel)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Depth */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Elevation Depth
            </label>
            <span className="text-xs font-mono text-primary font-bold">Level {config.depth}</span>
          </div>
          <Slider
            min={1}
            max={4}
            step={1}
            value={[config.depth]}
            onValueChange={(val) => onChange({ depth: val[0] ?? 2 })}
            className="py-2"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground/80 px-0.5">
            <span>Flat (1)</span>
            <span>Floating (2)</span>
            <span>Overlay (3)</span>
            <span>Modal (4)</span>
          </div>
        </div>

        {/* Variant Theme */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Variant Theme Override
          </label>
          <Select
            value={config.variant}
            onValueChange={(val) => onChange({ variant: val as VariantType })}
          >
            <SelectTrigger className="w-full bg-background/50 border-border/40 rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="base">Default Base Theme</SelectItem>
              <SelectItem value="mycountry">MyCountry Theme (Amber)</SelectItem>
              <SelectItem value="global">Global Theme (Blue)</SelectItem>
              <SelectItem value="eci">ECI Theme (Indigo)</SelectItem>
              <SelectItem value="sdi">SDI Theme (Red)</SelectItem>
              <SelectItem value="forum">Forum Theme (Orange)</SelectItem>
              <SelectItem value="builder">Builder Theme (Green)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Texture Type */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Tactile Texture Overlay
          </label>
          <Select
            value={config.texture}
            onValueChange={(val) => onChange({ texture: val as TextureType })}
          >
            <SelectTrigger className="w-full bg-background/50 border-border/40 rounded-lg">
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
            </SelectContent>
          </Select>
        </div>

        {/* Texture Opacity */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Texture Intensity
            </label>
            <span className="text-xs font-mono font-bold text-primary">
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

        {/* Interactivity */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Interactivity Profile
          </label>
          <Select
            value={config.interactivity}
            onValueChange={(val) => onChange({ interactivity: val as InteractivityType })}
          >
            <SelectTrigger className="w-full bg-background/50 border-border/40 rounded-lg">
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

        {/* Toggles */}
        <div className="border-t border-border/20 pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-foreground">
                Pointer Light Interactions
              </span>
              <span className="text-[10px] text-muted-foreground">
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
