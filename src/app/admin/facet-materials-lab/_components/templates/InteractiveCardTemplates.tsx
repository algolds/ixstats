import * as React from "react";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { cn } from "~/lib/utils";
import {
  Component as Layers,
  Activity,
  Globe,
  Star,
  Hexagon,
  Package as Box,
  Code,
  NavArrowRight as ChevronRight,
} from "iconoir-react";
import { type LabConfig } from "../types";

interface CardTemplateProps {
  config: LabConfig;
  previewRef: React.RefObject<HTMLDivElement | null>;
  dynamicStyles: React.CSSProperties;
  generatedClassNames: string;
  accentVars: React.CSSProperties;
  activeNode: number | null;
  setActiveNode: (n: number | null) => void;
  secureStatus: boolean;
  setSecureStatus: (s: boolean) => void;
  linkEstablished: boolean;
  linking: boolean;
  handleLinkClick: () => void;
  buttonClickCount: number;
  setButtonClickCount: React.Dispatch<React.SetStateAction<number>>;
  glassClickStates: Record<string, boolean>;
  setGlassClickStates: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

export function InteractiveCardTemplates({
  config,
  previewRef,
  dynamicStyles,
  generatedClassNames,
  accentVars,
  activeNode,
  setActiveNode,
  secureStatus,
  setSecureStatus,
  linkEstablished,
  linking,
  handleLinkClick,
  buttonClickCount,
  setButtonClickCount,
  glassClickStates,
  setGlassClickStates,
}: CardTemplateProps) {
  const { template, material, texture, textureOpacity, depth, variant, customAccent } = config;

  switch (template) {
    case "material-block":
      return (
        <div
          ref={previewRef}
          className={cn(
            generatedClassNames,
            "flex aspect-[4/3] w-full flex-col items-center justify-center p-6 text-center"
          )}
          style={{ ...dynamicStyles, ...accentVars }}
        >
          <TextureOverlay
            texture={texture}
            opacity={textureOpacity}
            className="z-0 rounded-[inherit]"
          />
          <div className="pointer-events-none relative z-10 space-y-2">
            <Layers className="text-primary mx-auto h-8 w-8 opacity-75" />
            <h4 className="text-base font-bold capitalize">{material} Material</h4>
            <p className="text-muted-foreground max-w-[200px] text-[11px] leading-relaxed">
              Depth Level {depth} with theme class &apos;{variant}&apos; and overlay texture &apos;
              {texture}&apos;.
            </p>
          </div>
        </div>
      );

    case "facet-card":
      return (
        <div
          ref={previewRef}
          className={cn(generatedClassNames, "flex w-full flex-col gap-4 p-6 text-left")}
          style={{ ...dynamicStyles, ...accentVars }}
        >
          <TextureOverlay
            texture={texture}
            opacity={textureOpacity}
            className="z-0 rounded-[inherit]"
          />
          <div className="relative z-10 flex items-start justify-between">
            <div>
              <h4 className="text-base leading-tight font-bold">MyCountry Security Core</h4>
              <p className="text-muted-foreground mt-0.5 text-[10px]">
                Integrity & Threat Profile Validation
              </p>
            </div>
            <button
              onClick={() => setSecureStatus(!secureStatus)}
              className="cursor-pointer rounded border px-2 py-0.5 text-[8px] font-bold tracking-wider uppercase transition-colors"
              style={{
                borderColor: secureStatus ? `${customAccent}4D` : "#ef44444D",
                backgroundColor: secureStatus ? `${customAccent}33` : "#ef444433",
                color: secureStatus ? customAccent : "#ef4444",
              }}
              title="Click to toggle security status"
            >
              {secureStatus ? "Secure" : "Breached"}
            </button>
          </div>
          <div className="border-border/10 pointer-events-none relative z-10 space-y-2 border-t pt-3.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Active Nodes:</span>
              <span className="font-mono font-bold">
                {secureStatus
                  ? linkEstablished
                    ? "12 / 12 Online"
                    : "11 / 12 Online"
                  : "0 / 12 Offline"}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Material Status:</span>
              <span className="font-semibold capitalize" style={{ color: customAccent }}>
                {material}
              </span>
            </div>
          </div>
          <div className="relative z-10 mt-2 flex gap-2">
            <button
              onClick={handleLinkClick}
              disabled={linking || !secureStatus}
              className="flex-1 cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
              style={{ backgroundColor: customAccent }}
            >
              {linking ? "Establishing..." : linkEstablished ? "Disconnect Link" : "Establish Link"}
            </button>
            <button
              onClick={() => setButtonClickCount((c) => c + 1)}
              className="bg-muted hover:bg-muted/80 text-muted-foreground border-border/20 cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
            >
              Details {buttonClickCount > 0 && `(${buttonClickCount})`}
            </button>
          </div>
        </div>
      );

    case "compounding-stack":
      return (
        <div
          ref={previewRef}
          className={cn(
            generatedClassNames,
            "facet-hierarchy-parent flex w-full flex-col gap-4 rounded-2xl p-5 text-left"
          )}
          style={{ ...dynamicStyles, ...accentVars }}
        >
          <TextureOverlay
            texture={texture}
            opacity={textureOpacity}
            className="z-0 rounded-[inherit]"
          />
          <div className="pointer-events-none relative z-10">
            <span className="text-muted-foreground mb-0.5 block text-[9px] font-bold tracking-widest uppercase">
              Parent Block (Depth 1)
            </span>
            <h4 className="text-base leading-tight font-bold">System Core Hub</h4>
          </div>

          <div className="facet-hierarchy-child relative z-10 flex flex-col gap-3 p-4">
            <div className="pointer-events-none">
              <span className="text-muted-foreground mb-0.5 block text-[8px] font-bold tracking-widest uppercase">
                Nested Child (Depth 2)
              </span>
              <p className="text-muted-foreground text-xs leading-relaxed">
                This element compounds the backdrop filter blurs recursively when placed inside a
                Parent.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setActiveNode(activeNode === 1 ? null : 1)}
                className={cn(
                  "facet-hierarchy-interactive relative z-20 flex-1 cursor-pointer px-3 py-2 text-center text-xs font-semibold transition-all",
                  activeNode === 1 ? "text-foreground border-2 font-bold" : "text-muted-foreground"
                )}
                style={{
                  borderColor: activeNode === 1 ? customAccent : `${customAccent}4D`,
                  boxShadow: activeNode === 1 ? `0 0 12px ${customAccent}40` : undefined,
                }}
              >
                Node Admin 1 {activeNode === 1 && "🟢"}
              </button>
              <button
                onClick={() => setActiveNode(activeNode === 2 ? null : 2)}
                className={cn(
                  "facet-hierarchy-interactive relative z-20 flex-1 cursor-pointer px-3 py-2 text-center text-xs font-semibold transition-all",
                  activeNode === 2 ? "text-foreground border-2 font-bold" : "text-muted-foreground"
                )}
                style={{
                  borderColor: activeNode === 2 ? customAccent : `${customAccent}4D`,
                  boxShadow: activeNode === 2 ? `0 0 12px ${customAccent}40` : undefined,
                }}
              >
                Node Admin 2 {activeNode === 2 && "🟢"}
              </button>
            </div>
          </div>
        </div>
      );

    case "enhanced-card":
      return (
        <div
          ref={previewRef}
          className={cn(generatedClassNames, "flex w-full flex-col gap-3 p-5 text-left")}
          style={{ ...dynamicStyles, ...accentVars }}
        >
          <TextureOverlay
            texture={texture}
            opacity={textureOpacity}
            className="z-0 rounded-[inherit]"
          />
          <div className="pointer-events-none relative z-10 flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${customAccent}20` }}
            >
              <Activity className="h-4 w-4" style={{ color: customAccent }} />
            </div>
            <div>
              <h4 className="text-sm leading-tight font-bold">System Overview</h4>
              <p className="text-muted-foreground text-[10px]">Real-time performance metrics</p>
            </div>
          </div>
          <div className="relative z-10 flex items-center justify-between border-t pt-2.5">
            <span className="text-muted-foreground text-xs">Efficiency Index</span>
            <span className="text-sm font-bold" style={{ color: customAccent }}>
              94.2%
            </span>
          </div>
        </div>
      );

    case "bento-card":
      return (
        <div
          ref={previewRef}
          className={cn(generatedClassNames, "flex aspect-[3/4] w-full flex-col justify-between p-5 text-left")}
          style={{ ...dynamicStyles, ...accentVars }}
        >
          <TextureOverlay
            texture={texture}
            opacity={textureOpacity}
            className="z-0 rounded-[inherit]"
          />
          <div className="pointer-events-none relative z-10 flex items-center justify-between">
            <Globe className="h-5 w-5" style={{ color: customAccent }} />
            <span className="text-muted-foreground font-mono text-[9px]">v1.4.0</span>
          </div>
          <div className="pointer-events-none relative z-10 space-y-1">
            <h4 className="text-base font-bold">Global Fabric</h4>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Spatial mesh coordinates and geopolitical alignment.
            </p>
          </div>
        </div>
      );

    case "progressive-blur":
      return (
        <div
          ref={previewRef}
          className={cn(generatedClassNames, "flex w-full flex-col gap-3 p-5 text-left")}
          style={{ ...dynamicStyles, ...accentVars }}
        >
          <TextureOverlay
            texture={texture}
            opacity={textureOpacity}
            className="z-0 rounded-[inherit]"
          />
          <div className="pointer-events-none relative z-10">
            <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              Progressive Diffusion
            </span>
            <h4 className="text-base font-bold">Stepped Layer Refraction</h4>
          </div>
          <div className="relative z-10 rounded-lg border border-white/10 bg-black/10 p-3 text-xs">
            Multi-stop gradient mask applied seamlessly across card surface.
          </div>
        </div>
      );

    case "glare-card":
      return (
        <div
          ref={previewRef}
          className={cn(
            generatedClassNames,
            "group relative flex aspect-[3/4] w-full cursor-pointer flex-col justify-between overflow-hidden p-6 text-left"
          )}
          style={{ ...dynamicStyles, ...accentVars }}
        >
          <TextureOverlay texture={texture} opacity={textureOpacity} className="z-0" />
          <div className="pointer-events-none relative z-10 flex items-center justify-between">
            <Star className="h-5 w-5" style={{ color: customAccent }} />
            <span className="text-muted-foreground font-mono text-[8px] uppercase">Specular Glare</span>
          </div>
          <div className="pointer-events-none relative z-10 space-y-1.5">
            <h4 className="text-base leading-tight font-bold">Refractive Edge</h4>
            <p className="text-muted-foreground text-[10px] leading-relaxed">
              Dynamic light specular tracking layer.
            </p>
          </div>
        </div>
      );

    case "cutout-card":
      return (
        <div
          ref={previewRef}
          className={cn(generatedClassNames, "relative flex w-full flex-col gap-4 overflow-hidden p-6 text-left")}
          style={{ ...dynamicStyles, ...accentVars }}
        >
          <TextureOverlay texture={texture} opacity={textureOpacity} className="z-0" />
          <div className="relative z-10 flex items-start justify-between">
            <div className="pointer-events-none space-y-1">
              <span className="text-muted-foreground block text-[9px] font-bold tracking-wider uppercase">
                Masked Chamfer
              </span>
              <h4 className="text-base font-bold">Cutout Specimen</h4>
            </div>
            <Hexagon className="h-6 w-6" style={{ color: customAccent }} />
          </div>
        </div>
      );

    case "comet-card":
      return (
        <div
          ref={previewRef}
          className={cn(
            generatedClassNames,
            "relative flex w-full cursor-pointer flex-col gap-4 overflow-hidden p-6 text-left"
          )}
          style={{ ...dynamicStyles, ...accentVars }}
        >
          <TextureOverlay texture={texture} opacity={textureOpacity} className="z-0" />
          <div className="pointer-events-none relative z-10 flex items-center justify-between">
            <span className="text-[9px] font-bold tracking-wider uppercase">Active Particle</span>
            <span className="font-mono text-[9px]" style={{ color: customAccent }}>
              Orbit Trajectory
            </span>
          </div>
          <div className="pointer-events-none relative z-10 space-y-1">
            <h4 className="text-base font-bold">Comet Particle Motion</h4>
            <p className="text-muted-foreground text-[10px] leading-relaxed">
              Orbital beam sweep along container perimeter border.
            </p>
          </div>
        </div>
      );

    case "texture-card":
      return (
        <div
          ref={previewRef}
          className={cn(generatedClassNames, "relative flex w-full flex-col gap-4 overflow-hidden p-6 text-left")}
          style={{ ...dynamicStyles, ...accentVars }}
        >
          <TextureOverlay texture={texture} opacity={textureOpacity} className="z-0" />
          <div className="pointer-events-none relative z-10 flex items-center gap-3">
            <Box className="h-5 w-5" style={{ color: customAccent }} />
            <div>
              <h4 className="text-sm font-bold capitalize">{texture} Tactile</h4>
              <p className="text-muted-foreground text-[10px]">Embedded SVG Noise Filter</p>
            </div>
          </div>
        </div>
      );

    case "code-block":
      return (
        <div
          ref={previewRef}
          className={cn(
            generatedClassNames,
            "flex w-full flex-col gap-3 overflow-hidden p-0 text-left"
          )}
          style={{ ...dynamicStyles, ...accentVars }}
        >
          <TextureOverlay texture={texture} opacity={textureOpacity} className="z-0" />
          <div
            className="pointer-events-none relative z-10 flex items-center justify-between gap-3 border-b px-4 py-3"
            style={{ borderColor: `${customAccent}15` }}
          >
            <div className="flex items-center gap-2">
              <Code className="h-3.5 w-3.5" style={{ color: customAccent }} />
              <span className="text-[10px] font-bold tracking-wide uppercase">Exported Code</span>
            </div>
            <span className="text-muted-foreground font-mono text-[8px]">
              .{"{"} material: {material}, depth: {depth} {"}"}
            </span>
          </div>
          <pre
            className="bg-muted/90 text-foreground max-h-[260px] overflow-x-auto px-4 pt-1 pb-4 font-mono text-[10px] leading-relaxed"
            style={{
              borderColor: `${customAccent}10`,
              tabSize: 2,
            }}
          >
            <code>{`<div className="${generatedClassNames}">\n  <TextureOverlay texture="${texture}" />\n</div>`}</code>
          </pre>
        </div>
      );

    default:
      return null;
  }
}
