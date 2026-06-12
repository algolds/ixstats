import { type TextureType } from "~/components/ui/texture-overlay";

export type MaterialType = "satin" | "paper" | "rubber" | "metal" | "glass" | "carbon" | "wood";
export type VariantType = "base" | "mycountry" | "global" | "overview" | "economy" | "military" | "cultural" | "security" | "forum" | "builder";
export type InteractivityType = "none" | "interactive" | "hierarchy-interactive";
export type TemplateType =
  | "material-block"
  | "facet-card"
  | "facet-button"
  | "compounding-stack"
  | "facet-navigation"
  | "enhanced-card"
  | "bento-card"
  | "progressive-blur"
  | "glare-card"
  | "cutout-card"
  | "comet-card"
  | "texture-card"
  | "health-rings"
  | "glass-button"
  | "brand-header"
  | "gradient-metrics"
  | "code-block";
export type BgStyleType = "refraction" | "gradient" | "solid" | "pattern" | "none";

export interface LabConfig {
  template: TemplateType;
  material: MaterialType;
  texture: TextureType;
  textureOpacity: number;
  depth: number;
  variant: VariantType;
  interactivity: InteractivityType;
  lightInteraction: boolean;
  simulatedTheme: "light" | "dark";
  customAccent: string;
  fullscreen: boolean;
  blurStrength: number;
  saturationBoost: number;
  glowIntensity: number;
  refractionEnabled: boolean;
  bgStyle: BgStyleType;
  bgCustomColor: string;
  patternScale: number;
  dofStrength: number;
}
