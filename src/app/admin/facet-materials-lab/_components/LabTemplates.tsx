import * as React from "react";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { cn } from "~/lib/utils";
import { Layers, Sparkles } from "lucide-react";
import { type LabConfig } from "./types";

interface TemplateRendererProps {
  config: LabConfig;
  previewRef: React.RefObject<HTMLDivElement | null>;
  dynamicStyles: React.CSSProperties;
  generatedClassNames: string;
}

export function LabTemplates({
  config,
  previewRef,
  dynamicStyles,
  generatedClassNames,
}: TemplateRendererProps) {
  const { template, material, texture, textureOpacity, depth, variant } = config;

  switch (template) {
    case "material-block":
      return (
        <div
          ref={previewRef}
          className={cn(
            generatedClassNames,
            "w-full aspect-[4/3] flex flex-col items-center justify-center text-center p-6"
          )}
          style={dynamicStyles}
        >
          <TextureOverlay texture={texture} opacity={textureOpacity} className="rounded-[inherit] z-0" />
          <div className="relative z-10 space-y-2 pointer-events-none">
            <Layers className="h-8 w-8 mx-auto opacity-75 text-primary" />
            <h4 className="font-bold text-base capitalize">{material} Material</h4>
            <p className="text-[11px] text-muted-foreground max-w-[200px] leading-relaxed">
              Depth Level {depth} with theme class '{variant}' and overlay texture '{texture}'.
            </p>
          </div>
        </div>
      );

    case "facet-card":
      return (
        <div
          ref={previewRef}
          className={cn(generatedClassNames, "w-full p-6 flex flex-col gap-4 text-left")}
          style={dynamicStyles}
        >
          <TextureOverlay texture={texture} opacity={textureOpacity} className="rounded-[inherit] z-0" />
          <div className="relative z-10 pointer-events-none flex justify-between items-start">
            <div>
              <h4 className="font-bold text-base leading-tight">MyCountry Security Core</h4>
              <p className="text-[10px] text-muted-foreground mt-0.5">Integrity & Threat Profile Validation</p>
            </div>
            <span className="px-2 py-0.5 rounded text-[8px] bg-indigo-500/20 text-indigo-400 font-bold uppercase tracking-wider border border-indigo-500/30">
              Secure
            </span>
          </div>
          <div className="relative z-10 pointer-events-none border-t border-border/10 pt-3.5 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Active Nodes:</span>
              <span className="font-mono font-bold">12 / 12 Online</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Material Status:</span>
              <span className="font-semibold text-primary capitalize">{material}</span>
            </div>
          </div>
          <div className="relative z-10 flex gap-2 mt-2">
            <button className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity">
              Establish Link
            </button>
            <button className="py-1.5 px-3 rounded-lg text-xs font-semibold bg-muted hover:bg-muted/80 transition-colors border border-border/20">
              Details
            </button>
          </div>
        </div>
      );

    case "facet-button":
      return (
        <div
          ref={previewRef}
          className={cn(
            generatedClassNames,
            "px-6 py-3.5 flex items-center justify-center gap-2 cursor-pointer select-none font-bold text-sm tracking-wide"
          )}
          style={dynamicStyles}
        >
          <TextureOverlay texture={texture} opacity={textureOpacity} className="rounded-[inherit] z-0" />
          <div className="relative z-10 pointer-events-none flex items-center gap-2">
            <Sparkles className="h-4.5 w-4.5 text-primary animate-pulse" />
            <span>Simulate Trigger Command</span>
          </div>
        </div>
      );

    case "compounding-stack":
      return (
        <div
          ref={previewRef}
          className="facet-hierarchy-parent w-full p-5 rounded-2xl flex flex-col gap-4 text-left border"
        >
          <div className="pointer-events-none">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block mb-0.5">
              Parent Block (Depth 1)
            </span>
            <h4 className="font-bold text-base leading-tight">System Core Hub</h4>
          </div>

          <div className="facet-hierarchy-child p-4 rounded-xl flex flex-col gap-3 border bg-white/5 dark:bg-black/5">
            <div className="pointer-events-none">
              <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest block mb-0.5">
                Nested Child (Depth 2)
              </span>
              <p className="text-xs text-muted-foreground leading-relaxed">
                This element compounds the backdrop filter blurs recursively when placed inside a Parent.
              </p>
            </div>

            <div className="flex gap-2">
              <button className="facet-hierarchy-interactive px-3 py-2 text-xs font-semibold flex-1 rounded-lg border text-center transition-all bg-white/10 dark:bg-white/5">
                Node Admin 1
              </button>
              <button className="facet-hierarchy-interactive px-3 py-2 text-xs font-semibold flex-1 rounded-lg border text-center transition-all bg-white/10 dark:bg-white/5">
                Node Admin 2
              </button>
            </div>
          </div>
        </div>
      );

    default:
      return null;
  }
}
