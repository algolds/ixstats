import * as React from "react";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { cn } from "~/lib/utils";
import {
  Sparks as Sparkles,
  Shield,
  Activity,
  StatsReport as BarChart3,
  Heart,
  Flash as Zap,
  Bell,
  NavArrowRight as ChevronRight,
} from "iconoir-react";
import { Button, type ButtonVariant } from "~/components/ui/button";
import { HealthRing } from "~/components/ui/health-ring";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Stat } from "~/components/ui/stat";
import { type LabConfig } from "../types";
import { Card } from "~/components/ui/card";

/*
 * Lab-only *frames* (the configurator's `facet-material-*` from `styles/facet/lab.css`) around
 * real primitives coloured by the tint, which `LabTemplates` scopes to the lab's
 * accent colour.
 */

const NAV_ITEMS = ["Dashboard", "Analytics", "Settings"] as const;

const VITALITY_RINGS = [
  { label: "Econ", value: 87, color: "var(--color-chart-1)" },
  { label: "Pop", value: 64, color: "var(--color-chart-2)" },
  { label: "Diplo", value: 92, color: "var(--color-chart-3)" },
  { label: "Gov", value: 71, color: "var(--color-chart-4)" },
] as const;

const BUTTON_STYLES: { label: string; variant: ButtonVariant }[] = [
  { label: "Primary action", variant: "default" },
  { label: "Secondary", variant: "secondary" },
  { label: "Neutral", variant: "secondary" },
  { label: "Danger", variant: "destructive" },
];

interface ActionTemplateProps {
  config: LabConfig;
  previewRef: React.RefObject<HTMLDivElement | null>;
  dynamicStyles: React.CSSProperties;
  generatedClassNames: string;
  accentVars: React.CSSProperties;
  activeNav: string;
  setActiveNav: (nav: string) => void;
  buttonClickCount: number;
  setButtonClickCount: React.Dispatch<React.SetStateAction<number>>;
  glassClickStates: Record<string, boolean>;
  setGlassClickStates: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

export function InteractiveActionTemplates({
  config,
  previewRef,
  dynamicStyles,
  generatedClassNames,
  accentVars,
  activeNav,
  setActiveNav,
  buttonClickCount,
  setButtonClickCount,
  glassClickStates,
  setGlassClickStates,
}: ActionTemplateProps) {
  const { template, material, texture, textureOpacity, depth } = config;

  switch (template) {
    case "facet-button":
      return (
        <div
          ref={previewRef}
          className={cn(
            generatedClassNames,
            "text-headline flex cursor-pointer items-center justify-center gap-2 px-6 py-4 select-none"
          )}
          style={{ ...dynamicStyles, ...accentVars }}
        >
          <TextureOverlay
            texture={texture}
            opacity={textureOpacity}
            className="z-0 rounded-[inherit]"
          />
          <div className="pointer-events-none relative z-10 flex items-center gap-2">
            <Sparkles aria-hidden className="text-tint size-5" />
            <span>Simulate trigger command</span>
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
          <div className="pointer-events-auto relative z-10 flex items-center justify-between">
            <div className="pointer-events-none flex items-center gap-2">
              <Shield aria-hidden className="text-tint h-4 w-4" />
              <span className="text-headline">IxStats</span>
            </div>
            <div className="relative z-20 flex items-center gap-3">
              <SegmentedControl
                size="sm"
                aria-label="Section"
                value={activeNav}
                onValueChange={setActiveNav}
                options={NAV_ITEMS.map((item) => ({ value: item, label: item }))}
              />
              <Button
                size="icon-sm"
                onClick={() => setButtonClickCount((c) => c + 1)}
                className="rounded-full"
                aria-label={`Profile (clicked ${buttonClickCount} times)`}
                title={`Profile clicked ${buttonClickCount} times`}
              >
                <span className="text-caption tabular-nums">
                  {buttonClickCount > 0 ? buttonClickCount : "A"}
                </span>
              </Button>
            </div>
          </div>
        </div>
      );

    case "health-rings":
      return (
        <div
          ref={previewRef}
          className={cn(generatedClassNames, "flex w-full flex-col gap-5 p-6 text-center")}
          style={{ ...dynamicStyles, ...accentVars }}
        >
          <TextureOverlay
            texture={texture}
            opacity={textureOpacity}
            className="z-0 rounded-[inherit]"
          />
          <div className="pointer-events-none relative z-10">
            <h4 className="text-headline">National vitality</h4>
            <p className="text-label-secondary text-footnote">
              {material} · depth {depth}
            </p>
          </div>
          <div className="pointer-events-none relative z-10 flex items-center justify-center gap-4">
            {VITALITY_RINGS.map((ring) => (
              <div key={ring.label} className="flex flex-col items-center gap-2">
                <HealthRing value={ring.value} size={72} color={ring.color} label={ring.label} />
                <span className="text-label-secondary text-eyebrow">{ring.label}</span>
              </div>
            ))}
          </div>
        </div>
      );

    case "glass-button":
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
          <div className="pointer-events-none relative z-10">
            <h4 className="text-headline">Button styles</h4>
            <p className="text-label-secondary text-footnote">
              {material} ·{" "}
              {depth === 1 ? "shallow" : depth === 2 ? "medium" : depth === 3 ? "deep" : "modal"}{" "}
              depth
            </p>
          </div>
          <div className="pointer-events-auto relative z-10 flex flex-col gap-2">
            {BUTTON_STYLES.map((btn) => {
              const isClicked = glassClickStates[btn.label] || false;
              return (
                <Button
                  key={btn.label}
                  variant={btn.variant}
                  aria-pressed={isClicked}
                  onClick={() =>
                    setGlassClickStates((prev) => ({ ...prev, [btn.label]: !isClicked }))
                  }
                >
                  <Zap aria-hidden className={cn("h-3.5 w-3.5", isClicked && "fill-current")} />
                  {btn.label} {isClicked && "✓"}
                </Button>
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
            "flex w-full flex-col gap-4 overflow-hidden p-6 text-center"
          )}
          style={{ ...dynamicStyles, ...accentVars }}
        >
          <TextureOverlay
            texture={texture}
            opacity={textureOpacity}
            className="z-0 rounded-[inherit]"
          />
          <div className="pointer-events-none relative z-10 mt-4 flex flex-col items-center gap-3">
            <div className="rounded-card bg-tint-fill text-tint flex h-14 w-14 items-center justify-center">
              <Shield aria-hidden className="h-7 w-7" />
            </div>
            <h3 className="text-title-1 text-label">IxStats</h3>
            <p className="text-label-secondary text-footnote max-w-[240px] leading-relaxed">
              Nation simulation with analytics and diplomatic intelligence.
            </p>
          </div>
          <div className="relative z-10 flex items-center justify-center gap-3">
            <Button onClick={() => setButtonClickCount((c) => c + 1)}>Get started</Button>
            <Button variant="outline">Learn more</Button>
          </div>
        </div>
      );

    case "gradient-metrics":
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
          <div className="pointer-events-none relative z-10">
            <h3 className="text-title-3 text-label">System overview</h3>
            <p className="text-label-secondary text-footnote mt-0.5">
              Performance overview on a {material} surface
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
                <Card key={metric.label} variant="inset" className="p-3">
                  <Stat
                    label={metric.label}
                    value={metric.value}
                    hint={metric.sub}
                    size="sm"
                    icon={<Icon aria-hidden className="text-tint" />}
                  />
                </Card>
              );
            })}
          </div>
          <div className="border-separator pointer-events-none relative z-10 flex items-center justify-between border-t pt-3">
            <span className="text-label-secondary text-footnote">Last updated 2m ago</span>
            <ChevronRight className="text-label-secondary h-3 w-3" />
          </div>
        </div>
      );

    default:
      return null;
  }
}
