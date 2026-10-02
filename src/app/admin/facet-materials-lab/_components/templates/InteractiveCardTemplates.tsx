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
} from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { FacetCard } from "~/components/ui/facet-container";
import { Stat } from "~/components/ui/stat";
import { Switch } from "~/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { type LabConfig } from "../types";

/*
 * Lab-only *frames*: each template's outer element carries the configurator's lab materials
 * (`facet-material-*`, `styles/facet/lab.css`). Everything inside is Facet 3 — real primitives
 * coloured by the tint, which `LabTemplates` scopes to the lab's accent colour.
 */

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
  const { template, material, texture, textureOpacity, depth, variant } = config;

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
            <div className="flex items-center gap-2">
              <Badge variant={secureStatus ? "success" : "destructive"}>
                {secureStatus ? "Secure" : "Breached"}
              </Badge>
              <Switch
                checked={secureStatus}
                onCheckedChange={setSecureStatus}
                aria-label="Security status"
                title="Toggle security status"
              />
            </div>
          </div>
          <div className="border-separator pointer-events-none relative z-10 space-y-2 border-t pt-4">
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
              <span className="text-tint font-semibold capitalize">{material}</span>
            </div>
          </div>
          <div className="relative z-10 mt-2 flex gap-2">
            <Button
              size="sm"
              onClick={handleLinkClick}
              disabled={linking || !secureStatus}
              className="flex-1"
            >
              {linking ? "Establishing..." : linkEstablished ? "Disconnect Link" : "Establish Link"}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setButtonClickCount((c) => c + 1)}>
              Details {buttonClickCount > 0 && `(${buttonClickCount})`}
            </Button>
          </div>
        </div>
      );

    case "compounding-stack":
      return (
        <div
          ref={previewRef}
          className={cn(
            generatedClassNames,
            "rounded-card flex w-full flex-col gap-4 p-5 text-left"
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
              Lab material (chrome)
            </span>
            <h4 className="text-headline leading-tight">System Core Hub</h4>
          </div>

          <FacetCard variant="inset" className="relative z-10 flex flex-col gap-3">
            <div className="pointer-events-none">
              <span className="text-label-secondary text-eyebrow mb-0.5 block">
                Opaque inset (content)
              </span>
              <p className="text-label-secondary text-footnote leading-relaxed">
                Materials never nest: inside a material, panels use the opaque surface-secondary
                role instead of a second blur.
              </p>
            </div>

            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              aria-label="Admin node"
              value={activeNode === null ? "" : String(activeNode)}
              onValueChange={(v) => setActiveNode(v ? Number(v) : null)}
              className="flex-nowrap gap-2 *:flex-1"
            >
              <ToggleGroupItem value="1">Node Admin 1</ToggleGroupItem>
              <ToggleGroupItem value="2">Node Admin 2</ToggleGroupItem>
            </ToggleGroup>
          </FacetCard>
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
            <div className="rounded-control bg-tint-fill text-tint flex h-9 w-9 items-center justify-center">
              <Activity aria-hidden className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-headline leading-tight">System Overview</h4>
              <p className="text-label-secondary text-footnote">Real-time performance metrics</p>
            </div>
          </div>
          <div className="border-separator relative z-10 border-t pt-3">
            <Stat label="Efficiency index" value="94.2%" size="sm" />
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
            <Globe aria-hidden className="text-tint h-5 w-5" />
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
          <div className="rounded-control border-separator bg-surface-secondary text-footnote relative z-10 border p-3">
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
            <Star aria-hidden className="text-tint h-5 w-5" />
            <span className="text-label-secondary text-eyebrow tabular-nums">Specular Glare</span>
          </div>
          <div className="pointer-events-none relative z-10 space-y-2">
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
            <Hexagon aria-hidden className="text-tint h-6 w-6" />
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
            <span className="text-footnote text-tint tabular-nums">Orbit Trajectory</span>
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
            <Box aria-hidden className="text-tint h-5 w-5" />
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
          <div className="border-separator pointer-events-none relative z-10 flex items-center justify-between gap-3 border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <Code aria-hidden className="text-tint h-3.5 w-3.5" />
              <span className="text-eyebrow">Exported Code</span>
            </div>
            <span className="text-label-secondary text-footnote tabular-nums">
              .{"{"} material: {material}, depth: {depth} {"}"}
            </span>
          </div>
          <pre
            className="bg-surface-secondary text-label text-footnote relative z-10 max-h-[260px] overflow-x-auto px-4 pt-1 pb-4 font-mono leading-relaxed"
            style={{ tabSize: 2 }}
          >
            <code>{`<div className="${generatedClassNames}">\n  <TextureOverlay texture="${texture}" />\n</div>`}</code>
          </pre>
        </div>
      );

    default:
      return null;
  }
}
