import * as React from "react";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { cn } from "~/lib/utils";
import { Layers, Sparkles, Shield, Activity, BarChart3, Globe, Menu, Star, Hexagon, Box, Heart, Zap, Bell, ChevronRight, Code } from "lucide-react";
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
  const { template, material, texture, textureOpacity, depth, variant, customAccent } = config;

  const accentVars = {
    "--facet-lab-accent": customAccent,
    "--accent": customAccent,
  } as React.CSSProperties;

  // Live component states for previews
  const [activeNode, setActiveNode] = React.useState<number | null>(null);
  const [secureStatus, setSecureStatus] = React.useState(true);
  const [linkEstablished, setLinkEstablished] = React.useState(false);
  const [linking, setLinking] = React.useState(false);
  const [activeNav, setActiveNav] = React.useState("Dashboard");
  const [buttonClickCount, setButtonClickCount] = React.useState(0);
  const [glassClickStates, setGlassClickStates] = React.useState<Record<string, boolean>>({});

  const handleLinkClick = () => {
    if (linkEstablished) {
      setLinkEstablished(false);
      return;
    }
    setLinking(true);
    setTimeout(() => {
      setLinking(false);
      setLinkEstablished(true);
    }, 1000);
  };

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
              Depth Level {depth} with theme class &apos;{variant}&apos; and overlay texture
              &apos;{texture}&apos;.
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
              className="rounded border px-2 py-0.5 text-[8px] font-bold tracking-wider uppercase transition-colors cursor-pointer"
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
                {secureStatus ? (linkEstablished ? "12 / 12 Online" : "11 / 12 Online") : "0 / 12 Offline"}
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
              className="flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40 cursor-pointer"
              style={{ backgroundColor: customAccent }}
            >
              {linking ? "Establishing..." : linkEstablished ? "Disconnect Link" : "Establish Link"}
            </button>
            <button
              onClick={() => setButtonClickCount((c) => c + 1)}
              className="bg-muted hover:bg-muted/80 text-muted-foreground border-border/20 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
            >
              Details {buttonClickCount > 0 && `(${buttonClickCount})`}
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
            "flex cursor-pointer items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold tracking-wide select-none"
          )}
          style={{ ...dynamicStyles, ...accentVars }}
        >
          <TextureOverlay
            texture={texture}
            opacity={textureOpacity}
            className="z-0 rounded-[inherit]"
          />
          <div className="pointer-events-none relative z-10 flex items-center gap-2">
            <Sparkles className="h-4.5 w-4.5 animate-pulse" style={{ color: customAccent }} />
            <span>Simulate Trigger Command</span>
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
                  "facet-hierarchy-interactive flex-1 px-3 py-2 text-center text-xs font-semibold transition-all relative z-20 cursor-pointer",
                  activeNode === 1 ? "text-foreground font-bold border-2" : "text-muted-foreground"
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
                  "facet-hierarchy-interactive flex-1 px-3 py-2 text-center text-xs font-semibold transition-all relative z-20 cursor-pointer",
                  activeNode === 2 ? "text-foreground font-bold border-2" : "text-muted-foreground"
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

    case "facet-navigation":
      return (
        <div
          ref={previewRef}
          className={cn(generatedClassNames, "flex w-full flex-col gap-4 p-4")}
          style={{ ...dynamicStyles, ...accentVars }}
        >
          <TextureOverlay
            texture={texture}
            opacity={textureOpacity}
            className="z-0 rounded-[inherit]"
          />
          <div className="relative z-10 flex items-center justify-between pointer-events-auto">
            <div className="flex items-center gap-2 pointer-events-none">
              <Shield className="h-4 w-4" style={{ color: customAccent }} />
              <span className="text-sm font-bold">IxStats</span>
            </div>
            <div className="flex items-center gap-3 relative z-20">
              {["Dashboard", "Analytics", "Settings"].map((item) => (
                <span
                  key={item}
                  onClick={() => setActiveNav(item)}
                  className={cn(
                    "cursor-pointer text-xs font-semibold transition-all px-2 py-0.5 rounded-md",
                    activeNav === item
                      ? "text-foreground bg-white/10 dark:bg-black/25 shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5 dark:hover:bg-black/10"
                  )}
                  style={{
                    color: activeNav === item ? customAccent : undefined
                  }}
                >
                  {item}
                </span>
              ))}
              <div
                onClick={() => setButtonClickCount((c) => c + 1)}
                className="ml-2 flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white cursor-pointer active:scale-95 transition-transform"
                style={{ backgroundColor: customAccent }}
                title={`Profile clicked ${buttonClickCount} times`}
              >
                {buttonClickCount > 0 ? buttonClickCount : "A"}
              </div>
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
          <div className="pointer-events-none relative z-10 grid grid-cols-2 gap-2">
            <div
              className="rounded-lg border p-2.5"
              style={{ borderColor: `${customAccent}20` }}
            >
              <span className="text-muted-foreground block text-[9px] font-semibold uppercase">
                CPU
              </span>
              <span className="font-mono text-sm font-bold">64%</span>
            </div>
            <div
              className="rounded-lg border p-2.5"
              style={{ borderColor: `${customAccent}20` }}
            >
              <span className="text-muted-foreground block text-[9px] font-semibold uppercase">
                Memory
              </span>
              <span className="font-mono text-sm font-bold">4.2 GB</span>
            </div>
          </div>
        </div>
      );

    case "bento-card":
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
          <div className="pointer-events-none relative z-10 flex h-20 items-center justify-center rounded-lg border border-dashed"
            style={{ borderColor: `${customAccent}30` }}
          >
            <BarChart3 className="h-6 w-6 opacity-40" style={{ color: customAccent }} />
          </div>
          <div className="pointer-events-none relative z-10">
            <h4 className="text-sm font-bold">Global Statistics</h4>
            <p className="text-muted-foreground mt-0.5 text-[10px] leading-relaxed">
              Cross-regional aggregate data with real-time updates and predictive modeling.
            </p>
          </div>
          <div className="pointer-events-none relative z-10 flex items-center gap-2 text-[10px]">
            <Globe className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground font-semibold">Updated 2m ago</span>
          </div>
        </div>
      );

    case "progressive-blur":
      return (
        <div
          ref={previewRef}
          className={cn(generatedClassNames, "flex w-full flex-col gap-4 p-5 text-left")}
          style={{ ...dynamicStyles, ...accentVars }}
        >
          <TextureOverlay
            texture={texture}
            opacity={textureOpacity}
            className="z-0 rounded-[inherit]"
          />
          <div className="pointer-events-none relative z-10">
            <h4 className="text-sm font-bold">Progressive Blur Demo</h4>
            <p className="text-muted-foreground mt-1 text-[10px] leading-relaxed">
              Content below is progressively blurred, revealing on interaction. The blur gradient
              intensity compounds with depth level {depth}.
            </p>
          </div>
          <div className="pointer-events-none relative z-10 space-y-1.5">
            {["Nation Status Report", "Economic Indicators", "Diplomatic Relations"].map(
              (item, i) => (
                <div
                  key={item}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2"
                  style={{
                    borderColor: `${customAccent}20`,
                    opacity: 1 - i * 0.15,
                    filter: i > 0 ? `blur(${i * 2}px)` : undefined,
                  }}
                >
                  <div
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: customAccent }}
                  />
                  <span className="text-[11px] font-semibold">{item}</span>
                </div>
              )
            )}
          </div>
        </div>
      );

    case "glare-card":
      return (
        <div
          ref={previewRef}
          className={cn(
            generatedClassNames,
            "group relative flex w-full flex-col gap-3 overflow-hidden p-6 text-left"
          )}
          style={{ ...dynamicStyles, ...accentVars }}
        >
          <TextureOverlay
            texture={texture}
            opacity={textureOpacity}
            className="z-0 rounded-[inherit]"
          />
          {/* Foil/glare overlay */}
          <div
            className="pointer-events-none absolute inset-0 z-[1] opacity-20 transition-opacity duration-500 group-hover:opacity-40"
            style={{
              background: `linear-gradient(135deg, ${customAccent}00 0%, ${customAccent}15 50%, ${customAccent}00 100%)`,
            }}
          />
          <div className="pointer-events-none relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${customAccent}25` }}
              >
                <Sparkles className="h-4 w-4" style={{ color: customAccent }} />
              </div>
              <div>
                <h4 className="text-sm font-bold">Glare Card</h4>
                <p className="text-muted-foreground text-[9px]">{material} finish</p>
              </div>
            </div>
            <Menu className="text-muted-foreground h-3.5 w-3.5" />
          </div>
          <div className="pointer-events-none relative z-10 mt-1">
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Hover to reveal anisotropic glare reflection across the surface.
            </p>
          </div>
          <div className="relative z-10 flex gap-2 pointer-events-auto">
            <button
              onClick={() => setButtonClickCount((c) => c + 1)}
              className="rounded-md px-3 py-1.5 text-[10px] font-bold text-white transition-opacity hover:opacity-90 cursor-pointer"
              style={{ backgroundColor: customAccent }}
            >
              Action {buttonClickCount > 0 && `(${buttonClickCount})`}
            </button>
            <button
              onClick={() => setButtonClickCount(0)}
              className="border-border/20 hover:bg-muted/50 text-muted-foreground rounded-md border px-3 py-1.5 text-[10px] font-semibold transition-colors cursor-pointer"
            >
              Reset
            </button>
          </div>
        </div>
      );

    case "cutout-card":
      return (
        <div
          ref={previewRef}
          className={cn(
            generatedClassNames,
            "group/cutout flex w-full cursor-pointer flex-col overflow-hidden rounded-[28px] text-left",
          )}
          style={{ ...dynamicStyles, ...accentVars }}
        >
          <TextureOverlay
            texture={texture}
            opacity={textureOpacity}
            className="z-0 rounded-[inherit]"
          />
          {/* Cutout corner decorative SVG */}
          <svg
            className="pointer-events-none absolute top-0 right-0 z-[2] h-48 w-48 select-none opacity-20"
            viewBox="0 0 200 200"
            fill="none"
            style={{ color: customAccent }}
          >
            <path
              d="M0 200C155.996 199.961 200.029 156.308 200 0V200H0Z"
              fill="currentColor"
            />
          </svg>
          <div className="pointer-events-none relative z-10 flex flex-col gap-3 p-6">
            <div className="flex items-start justify-between">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${customAccent}20` }}
              >
                <Star className="h-5 w-5" style={{ color: customAccent }} />
              </div>
              <span
                className="rounded-full px-2.5 py-0.5 text-[9px] font-bold tracking-wider uppercase"
                style={{
                  backgroundColor: `${customAccent}15`,
                  color: customAccent,
                  border: `1px solid ${customAccent}30`,
                }}
              >
                New
              </span>
            </div>
            <div>
              <h4 className="text-base font-bold">Cutout Card</h4>
              <p className="text-muted-foreground mt-0.5 text-[11px] leading-relaxed">
                Distinctive corner cutout geometry with the {material} material finish and
                elevation depth {depth}.
              </p>
            </div>
          </div>
          <div
            className="pointer-events-none relative z-10 flex items-center justify-between border-t px-6 py-3.5"
            style={{ borderColor: `${customAccent}15` }}
          >
            <span className="text-muted-foreground text-[10px] font-semibold">Learn More</span>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: customAccent }} />
              <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: `${customAccent}60` }} />
              <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: `${customAccent}30` }} />
            </div>
          </div>
        </div>
      );

    case "comet-card":
      return (
        <div
          ref={previewRef}
          className={cn(
            generatedClassNames,
            "flex w-full flex-col gap-4 overflow-hidden p-6 text-left",
          )}
          style={{
            ...dynamicStyles,
            ...accentVars,
            transformStyle: "preserve-3d",
            perspective: "800px",
          }}
        >
          <TextureOverlay
            texture={texture}
            opacity={textureOpacity}
            className="z-0 rounded-[inherit]"
          />
          {/* Holographic shimmer band */}
          <div
            className="pointer-events-none absolute inset-0 z-[1] opacity-10"
            style={{
              background: `linear-gradient(135deg, transparent 0%, ${customAccent} 25%, transparent 50%, ${customAccent}22 75%, transparent 100%)`,
              backgroundSize: "200% 200%",
            }}
          />
          <div className="pointer-events-none relative z-10 flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{
                backgroundColor: `${customAccent}18`,
                boxShadow: `0 0 20px ${customAccent}20`,
              }}
            >
              <Hexagon className="h-6 w-6" style={{ color: customAccent }} />
            </div>
            <div>
              <h4 className="text-base font-bold">3D Comet Card</h4>
              <p className="text-muted-foreground text-[10px]">
                Holographic tilt with {material} finish
              </p>
            </div>
          </div>
          <div className="pointer-events-none relative z-10 grid grid-cols-2 gap-2">
            <div className="rounded-lg border p-2.5" style={{ borderColor: `${customAccent}15` }}>
              <span className="text-muted-foreground block text-[8px] font-bold uppercase tracking-wider">
                Rotation
              </span>
              <span className="font-mono text-sm font-bold">17.5°</span>
            </div>
            <div className="rounded-lg border p-2.5" style={{ borderColor: `${customAccent}15` }}>
              <span className="text-muted-foreground block text-[8px] font-bold uppercase tracking-wider">
                Depth
              </span>
              <span className="font-mono text-sm font-bold">Level {depth}</span>
            </div>
          </div>
          <div className="pointer-events-none relative z-10 text-[10px] leading-relaxed opacity-60">
            Mouse-tracked 3D perspective with spring physics and holographic shimmer overlay.
          </div>
        </div>
      );

    case "texture-card":
      return (
        <div ref={previewRef} className={cn(generatedClassNames, "flex w-full flex-col text-left")}
          style={{ ...dynamicStyles, ...accentVars }}>
          <TextureOverlay
            texture={texture}
            opacity={textureOpacity}
            className="z-0 rounded-[inherit]"
          />
          {/* Multi-border nested structure mimicking TextureCard */}
          <div
            className="facet-texture-card relative w-full pointer-events-none"
            style={{ "--radius": "24px" } as React.CSSProperties}
          >
            <div className="facet-texture-card-level-1">
              <div className="facet-texture-card-level-2">
                <div className="facet-texture-card-level-3">
                  <div className="facet-texture-card-inner flex flex-col gap-4 from-card/70 to-secondary/50 bg-gradient-to-b p-6">
                    <div className="relative z-10">
                      <div className="flex items-center gap-2">
                        <Box className="h-4 w-4" style={{ color: customAccent }} />
                        <h4 className="text-sm font-bold">Texture Card</h4>
                      </div>
                      <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
                        Four-layer nested border structure with {texture} texture overlay and
                        {material} base material at depth {depth}.
                      </p>
                    </div>
                    <div
                      className="relative z-10 flex items-center gap-3 rounded-lg border px-4 py-2.5"
                      style={{ borderColor: `${customAccent}20` }}
                    >
                      <div className="flex-1">
                        <div className="text-muted-foreground text-[9px] font-semibold uppercase">
                          Bandwidth
                        </div>
                        <div className="mt-0.5 flex items-center gap-2">
                          <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: "72%",
                                backgroundColor: customAccent,
                              }}
                            />
                          </div>
                          <span className="font-mono text-[10px] font-bold">72%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );

    case "health-rings":
      return (
        <div
          ref={previewRef}
          className={cn(
            generatedClassNames,
            "flex w-full flex-col gap-5 p-6 text-center",
          )}
          style={{ ...dynamicStyles, ...accentVars }}
        >
          <TextureOverlay
            texture={texture}
            opacity={textureOpacity}
            className="z-0 rounded-[inherit]"
          />
          <div className="pointer-events-none relative z-10">
            <h4 className="text-sm font-bold">National Vitality</h4>
            <p className="text-muted-foreground text-[10px]">{material} · depth {depth}</p>
          </div>
          <div className="pointer-events-none relative z-10 flex items-center justify-center gap-4">
            {[
              { label: "Econ", value: 87, color: "#10b981" },
              { label: "Pop", value: 64, color: "#3b82f6" },
              { label: "Diplo", value: 92, color: "#8b5cf6" },
              { label: "Gov", value: 71, color: "#f59e0b" },
            ].map((ring) => {
              const circumference = 2 * Math.PI * 28;
              const offset = circumference - (ring.value / 100) * circumference;
              return (
                <div key={ring.label} className="flex flex-col items-center gap-1.5">
                  <svg width="72" height="72" className="-rotate-90">
                    <circle cx="36" cy="36" r="28" fill="none" stroke="currentColor" strokeWidth="5"
                      className="text-border" />
                    <circle cx="36" cy="36" r="28" fill="none" stroke={ring.color} strokeWidth="5"
                      strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
                      className="transition-all duration-700" />
                  </svg>
                  <span className="font-mono text-xs font-bold" style={{ color: ring.color }}>
                    {ring.value}%
                  </span>
                  <span className="text-muted-foreground text-[8px] font-semibold uppercase tracking-wider">
                    {ring.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );

    case "glass-button":
      return (
        <div
          ref={previewRef}
          className={cn(
            generatedClassNames,
            "flex w-full flex-col gap-4 p-6 text-left",
          )}
          style={{ ...dynamicStyles, ...accentVars }}
        >
          <TextureOverlay
            texture={texture}
            opacity={textureOpacity}
            className="z-0 rounded-[inherit]"
          />
          <div className="pointer-events-none relative z-10">
            <h4 className="text-sm font-bold">Glass Button Variants</h4>
            <p className="text-muted-foreground text-[10px]">
              {material} · {depth === 1 ? "shallow" : depth === 2 ? "medium" : depth === 3 ? "deep" : "modal"} depth
            </p>
          </div>
          <div className="relative z-10 flex flex-col gap-2 pointer-events-auto">
            {[
              { label: "Primary Action", color: customAccent },
              { label: "Secondary", color: "#3b82f6" },
              { label: "Neutral", color: "#6b7280" },
              { label: "Danger", color: "#ef4444" },
            ].map((btn) => {
              const isClicked = glassClickStates[btn.label] || false;
              return (
                <button
                  key={btn.label}
                  onClick={() => setGlassClickStates(prev => ({ ...prev, [btn.label]: !isClicked }))}
                  className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold tracking-wide backdrop-blur-sm transition-all hover:opacity-90 active:scale-98"
                  style={{
                    backgroundColor: isClicked ? `${btn.color}33` : `${btn.color}18`,
                    borderColor: isClicked ? btn.color : `${btn.color}30`,
                    color: btn.color,
                    boxShadow: isClicked 
                      ? `inset 0 1px 0 ${btn.color}40, 0 0 12px ${btn.color}25`
                      : `inset 0 1px 0 ${btn.color}20, 0 4px 12px ${btn.color}10`,
                  }}
                >
                  <Zap className={cn("h-3.5 w-3.5", isClicked && "fill-current")} />
                  {btn.label} {isClicked && "✓"}
                </button>
              );
            })}
          </div>
        </div>
      );

    case "brand-header":
      return (
        <div
          ref={previewRef}
          className={cn(
            generatedClassNames,
            "flex w-full flex-col gap-4 overflow-hidden p-6 text-center",
          )}
          style={{ ...dynamicStyles, ...accentVars }}
        >
          <TextureOverlay
            texture={texture}
            opacity={textureOpacity}
            className="z-0 rounded-[inherit]"
          />
          {/* Glow effect */}
          <div
            className="pointer-events-none absolute -top-8 left-1/2 z-0 h-24 w-3/4 -translate-x-1/2 rounded-full opacity-30 blur-3xl"
            style={{ backgroundColor: customAccent }}
          />
          <div className="pointer-events-none relative z-10 mt-4 flex flex-col items-center gap-3">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{
                backgroundColor: `${customAccent}20`,
                boxShadow: `0 0 30px ${customAccent}20`,
              }}
            >
              <Shield className="h-7 w-7" style={{ color: customAccent }} />
            </div>
            <h3
              className="bg-clip-text text-2xl font-black tracking-tight text-transparent"
              style={{
                backgroundImage: `linear-gradient(to bottom, ${customAccent}, ${customAccent}99)`,
              }}
            >
              IxStats
            </h3>
            <p className="text-muted-foreground max-w-[240px] text-[10px] leading-relaxed">
              Next-generation nation simulation platform with real-time analytics and diplomatic
              intelligence.
            </p>
          </div>
          <div className="pointer-events-none relative z-10 flex items-center justify-center gap-3">
            <div
              className="rounded-lg px-4 py-2 text-[10px] font-bold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: customAccent }}
            >
              Get Started
            </div>
            <div
              className="rounded-lg border px-4 py-2 text-[10px] font-bold transition-colors"
              style={{ borderColor: `${customAccent}40`, color: customAccent }}
            >
              Learn More
            </div>
          </div>
        </div>
      );

    case "gradient-metrics":
      return (
        <div
          ref={previewRef}
          className={cn(
            generatedClassNames,
            "flex w-full flex-col gap-4 p-6 text-left",
          )}
          style={{ ...dynamicStyles, ...accentVars }}
        >
          <TextureOverlay
            texture={texture}
            opacity={textureOpacity}
            className="z-0 rounded-[inherit]"
          />
          <div className="pointer-events-none relative z-10">
            <h3
              className="bg-clip-text text-lg font-black tracking-tight text-transparent"
              style={{
                backgroundImage: `linear-gradient(to right, ${customAccent}, ${customAccent}bb, ${customAccent}66)`,
              }}
            >
              System Overview
            </h3>
            <p className="text-muted-foreground mt-0.5 text-[10px]">
              Real-time performance with {material} surface
            </p>
          </div>
          <div className="pointer-events-none relative z-10 grid grid-cols-2 gap-3">
            {[
              { label: "CPU Usage", value: "64%", sub: "8 cores", icon: Activity },
              { label: "Memory", value: "4.2 GB", sub: "16 GB total", icon: BarChart3 },
              { label: "Requests", value: "1,847", sub: "/min", icon: Heart },
              { label: "Latency", value: "42ms", sub: "p99", icon: Bell },
            ].map((metric) => {
              const Icon = metric.icon;
              return (
                <div
                  key={metric.label}
                  className="rounded-xl border p-3"
                  style={{ borderColor: `${customAccent}15` }}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-3 w-3" style={{ color: customAccent }} />
                    <span className="text-muted-foreground text-[8px] font-semibold uppercase tracking-wider">
                      {metric.label}
                    </span>
                  </div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="font-mono text-lg font-bold">{metric.value}</span>
                    <span className="text-muted-foreground font-mono text-[9px]">{metric.sub}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="pointer-events-none relative z-10 flex items-center justify-between border-t pt-3"
            style={{ borderColor: `${customAccent}10` }}>
            <span className="text-muted-foreground text-[9px]">Last updated 2m ago</span>
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          </div>
        </div>
      );

    case "code-block":
      return (
        <div
          ref={previewRef}
          className={cn(
            generatedClassNames,
            "flex w-full flex-col gap-3 overflow-hidden p-0 text-left",
          )}
          style={{ ...dynamicStyles, ...accentVars }}
        >
          <TextureOverlay
            texture={texture}
            opacity={textureOpacity}
            className="z-0"
          />
          <div className="pointer-events-none relative z-10 flex items-center justify-between gap-3 border-b px-4 py-3"
            style={{ borderColor: `${customAccent}15` }}>
            <div className="flex items-center gap-2">
              <Code className="h-3.5 w-3.5" style={{ color: customAccent }} />
              <span className="text-[10px] font-bold tracking-wide uppercase">Exported Code</span>
            </div>
            <span className="text-muted-foreground text-[8px] font-mono">.{'{'} material: {material}, depth: {depth} {'}'}</span>
          </div>
          <pre
            className="bg-muted/90 max-h-[260px] overflow-x-auto px-4 pb-4 pt-1 font-mono text-[10px] leading-relaxed text-foreground"
            style={{
              borderColor: `${customAccent}10`,
              tabSize: 2,
            }}
          >
            <code>{`import { FacetMaterial } from "~/components/facet-ui/shared/FacetMaterial";
import { TextureOverlay } from "~/components/ui/texture-overlay";

export default function CustomFacetWidget() {
  return (
    <div className="${generatedClassNames}">
      <TextureOverlay texture="${texture}" opacity={${textureOpacity}} />
      <div className="relative z-10 w-full h-full p-6">
        {/* content */}
      </div>
    </div>
  );
}`}</code>
          </pre>
        </div>
      );

    default:
      return null;
  }
}
