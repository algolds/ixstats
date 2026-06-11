import { type TextureType } from "~/components/ui/texture-overlay";

export type MaterialType = "satin" | "paper" | "rubber" | "metal";
export type VariantType = "base" | "mycountry" | "global" | "eci" | "sdi" | "forum" | "builder";
export type InteractivityType = "none" | "interactive" | "hierarchy-interactive";
export type TemplateType = "material-block" | "facet-card" | "facet-button" | "compounding-stack";

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
}
