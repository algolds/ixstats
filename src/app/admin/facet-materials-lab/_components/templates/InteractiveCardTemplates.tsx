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
            <Layers className="text-tint mx-auto h-8 w-8 opacity-75" />
            <h4 className="text-headline capitalize">{material} Material</h4>
            <p className="text-label-secondary text-footnote max-w-[200px] leading-relaxed">
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
              <h4 className="text-headline leading-tight">MyCountry Security Core</h4>
              <p className="text-label-secondary text-footnote mt-0.5">
                Integrity & Threat Profile Validation
              </p>
            </div>
            <button
              onClick={() => setSecureStatus(!secureStatus)}
              className="rounded-control-sm text-eyebrow cursor-pointer border px-2 py-0.5 transition-colors"
              style={{
                borderColor: secureStatus ? `${customAccent}4D` : "#ef44444D",
                backgroundColor: secureStatus ? `${customAccent}33` : "#ef444433",
                color: secureStatus ? customAccent : "var(--color-error)",
              }}
              title="Click to toggle security status"
            >
              {secureStatus ? "Secure" : "Breached"}
            </button>
          </div>
          <div className="border-separator pointer-events-none relative z-10 space-y-2 border-t pt-3.5">
            <div className="text-footnote flex justify-between">
              <span className="text-label-secondary">Active Nodes:</span>
              <span className="font-semibold tabular-nums">
                {secureStatus
                  ? linkEstablished
                    ? "12 / 12 Online"
                    : "11 / 12 Online"
                  : "0 / 12 Offline"}
              </span>
            </div>
            <div className="text-footnote flex justify-between">
              <span className="text-label-secondary">Material Status:</span>
              <span className="font-semibold capitalize" style={{ color: customAccent }}>
                {material}
              </span>
            </div>
          </div>
          <div className="relative z-10 mt-2 flex gap-2">
            <button
              onClick={handleLinkClick}
              disabled={linking || !secureStatus}
              className="rounded-control text-caption text-label flex-1 cursor-pointer px-3 py-1.5 transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
              style={{ backgroundColor: customAccent }}
            >
              {linking ? "Establishing..." : linkEstablished ? "Disconnect Link" : "Establish Link"}
            </button>
            <button
              onClick={() => setButtonClickCount((c) => c + 1)}
              className="bg-fill-3 hover:bg-fill-4 text-label-secondary border-separator rounded-control text-caption cursor-pointer border px-3 py-1.5 transition-colors"
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
            "facet-hierarchy-parent rounded-card flex w-full flex-col gap-4 p-5 text-left"
          )}
          style={{ ...dynamicStyles, ...accentVars }}
        >
          <TextureOverlay
            texture={texture}
            opacity={textureOpacity}
            className="z-0 rounded-[inherit]"
          />
          <div className="pointer-events-none relative z-10">
            <span className="text-label-secondary text-eyebrow mb-0.5 block">
              Parent Block (Depth 1)
            </span>
            <h4 className="text-headline leading-tight">System Core Hub</h4>
          </div>

          <div className="facet-hierarchy-child relative z-10 flex flex-col gap-3 p-4">
            <div className="pointer-events-none">
              <span className="text-label-secondary text-eyebrow mb-0.5 block">
                Nested Child (Depth 2)
              </span>
              <p className="text-label-secondary text-footnote leading-relaxed">
                This element compounds the backdrop filter blurs recursively when placed inside a
                Parent.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setActiveNode(activeNode === 1 ? null : 1)}
                className={cn(
                  "facet-hierarchy-interactive text-caption relative z-20 flex-1 cursor-pointer px-3 py-2 text-center transition-[color,background-color,border-color,box-shadow,opacity,transform]",
                  activeNode === 1 ? "text-label border-2 font-semibold" : "text-label-secondary"
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
                  "facet-hierarchy-interactive text-caption relative z-20 flex-1 cursor-pointer px-3 py-2 text-center transition-[color,background-color,border-color,box-shadow,opacity,transform]",
                  activeNode === 2 ? "text-label border-2 font-semibold" : "text-label-secondary"
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
              className="rounded-control flex h-9 w-9 items-center justify-center"
              style={{ backgroundColor: `${customAccent}20` }}
            >
              <Activity className="h-4 w-4" style={{ color: customAccent }} />
            </div>
            <div>
              <h4 className="text-headline leading-tight">System Overview</h4>
              <p className="text-label-secondary text-footnote">Real-time performance metrics</p>
            </div>
          </div>
          <div className="relative z-10 flex items-center justify-between border-t pt-2.5">
            <span className="text-label-secondary text-footnote">Efficiency Index</span>
            <span className="text-headline" style={{ color: customAccent }}>
              94.2%
            </span>
          </div>
        </div>
      );

    case "bento-card":
      return (
        <div
          ref={previewRef}
          className={cn(
            generatedClassNames,
            "flex aspect-[3/4] w-full flex-col justify-between p-5 text-left"
          )}
          style={{ ...dynamicStyles, ...accentVars }}
        >
          <TextureOverlay
            texture={texture}
            opacity={textureOpacity}
            className="z-0 rounded-[inherit]"
          />
          <div className="pointer-events-none relative z-10 flex items-center justify-between">
            <Globe className="h-5 w-5" style={{ color: customAccent }} />
            <span className="text-label-secondary text-footnote tabular-nums">v1.4.0</span>
          </div>
          <div className="pointer-events-none relative z-10 space-y-1">
            <h4 className="text-headline">Global Fabric</h4>
            <p className="text-label-secondary text-footnote leading-relaxed">
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
            <span className="text-label-secondary text-eyebrow">Progressive Diffusion</span>
            <h4 className="text-headline">Stepped Layer Refraction</h4>
          </div>
          <div className="rounded-control border-separator bg-fill-4 text-footnote relative z-10 border p-3">
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
            <span className="text-label-secondary text-eyebrow tabular-nums">Specular Glare</span>
          </div>
          <div className="pointer-events-none relative z-10 space-y-1.5">
            <h4 className="text-headline leading-tight">Refractive Edge</h4>
            <p className="text-label-secondary text-footnote leading-relaxed">
              Dynamic light specular tracking layer.
            </p>
          </div>
        </div>
      );

    case "cutout-card":
      return (
        <div
          ref={previewRef}
          className={cn(
            generatedClassNames,
            "relative flex w-full flex-col gap-4 overflow-hidden p-6 text-left"
          )}
          style={{ ...dynamicStyles, ...accentVars }}
        >
          <TextureOverlay texture={texture} opacity={textureOpacity} className="z-0" />
          <div className="relative z-10 flex items-start justify-between">
            <div className="pointer-events-none space-y-1">
              <span className="text-label-secondary text-eyebrow block">Masked Chamfer</span>
              <h4 className="text-headline">Cutout Specimen</h4>
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
            <span className="text-eyebrow">Active Particle</span>
            <span className="text-footnote tabular-nums" style={{ color: customAccent }}>
              Orbit Trajectory
            </span>
          </div>
          <div className="pointer-events-none relative z-10 space-y-1">
            <h4 className="text-headline">Comet Particle Motion</h4>
            <p className="text-label-secondary text-footnote leading-relaxed">
              Orbital beam sweep along container perimeter border.
            </p>
          </div>
        </div>
      );

    case "texture-card":
      return (
        <div
          ref={previewRef}
          className={cn(
            generatedClassNames,
            "relative flex w-full flex-col gap-4 overflow-hidden p-6 text-left"
          )}
          style={{ ...dynamicStyles, ...accentVars }}
        >
          <TextureOverlay texture={texture} opacity={textureOpacity} className="z-0" />
          <div className="pointer-events-none relative z-10 flex items-center gap-3">
            <Box className="h-5 w-5" style={{ color: customAccent }} />
            <div>
              <h4 className="text-headline capitalize">{texture} Tactile</h4>
              <p className="text-label-secondary text-footnote">Embedded SVG Noise Filter</p>
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
              <span className="text-eyebrow">Exported Code</span>
            </div>
            <span className="text-label-secondary text-footnote tabular-nums">
              .{"{"} material: {material}, depth: {depth} {"}"}
            </span>
          </div>
          <pre
            className="bg-fill-3 text-label text-footnote max-h-[260px] overflow-x-auto px-4 pt-1 pb-4 font-mono leading-relaxed"
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
