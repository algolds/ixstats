import "~/styles/card-art.css";
import React from "react";
import { MediaImage as ImageIcon, BookStack as Library, Palette } from "iconoir-react";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { proxyCardArtwork } from "~/lib/cards/ns-image-proxy";
import { getCategoryLabel } from "~/lib/cards/category-theme";
import type { CardDesignState } from "../types";
import { COLOR_PRESETS } from "./rack-constants";

interface RackAppearanceSectionProps {
  state: CardDesignState;
  onChange: (updater: (prev: CardDesignState) => CardDesignState) => void;
  onOpenIconBrowser: (target: "emblem" | "watermark") => void;
}

type OnChange = RackAppearanceSectionProps["onChange"];

/** Icon picker row (current icon or the category default), numeric slider and colour swatches. */
function SigilPanel(props: {
  state: CardDesignState;
  onChange: OnChange;
  onBrowse: () => void;
  title: string;
  browseLabel: string;
  defaultLabel: string;
  iconKey: "emblemIcon" | "watermarkIcon";
  colorKey: "emblemColor" | "watermarkColor";
  colorLabel: string;
  slider: {
    label: string;
    key: "emblemScale" | "watermarkOpacity";
    min: string;
    max: string;
    format: (value: number) => string;
  };
}) {
  const { state, onChange, iconKey, colorKey, slider } = props;
  const icon = state[iconKey];
  const color = state[colorKey];
  const sliderValue = state[slider.key];

  return (
    <div className="border-separator bg-fill-4 rounded-control space-y-2 border p-3">
      <div className="flex items-center justify-between">
        <span className="text-label text-footnote font-semibold">{props.title}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={props.onBrowse}
          className="text-footnote h-6 gap-1 px-2"
        >
          <Library className="text-tint h-3 w-3" />
          {props.browseLabel}
        </Button>
      </div>

      {icon ? (
        <div className="border-separator bg-surface rounded-control flex items-center justify-between border p-2">
          <div className="flex items-center gap-2">
            <div className="bg-fill-3 border-separator flex h-6 w-6 items-center justify-center rounded border p-0.5">
              <img
                src={icon.path}
                alt={icon.name}
                className="h-full w-full object-contain invert filter"
              />
            </div>
            <span className="text-footnote max-w-[90px] truncate font-medium">{icon.name}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange((p) => ({ ...p, [iconKey]: null }))}
            className="text-label-secondary hover:text-destructive text-footnote h-5 px-1"
          >
            Reset
          </Button>
        </div>
      ) : (
        <div className="text-label-secondary text-footnote italic">{props.defaultLabel}</div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <span className="text-label-secondary text-footnote shrink-0">{slider.label}</span>
        <input
          type="range"
          min={slider.min}
          max={slider.max}
          step="0.05"
          value={sliderValue}
          onChange={(e) => onChange((p) => ({ ...p, [slider.key]: Number(e.target.value) }))}
          className="bg-fill-3 accent-primary rounded-control h-1 flex-1"
        />
        <span className="text-label text-footnote w-7 text-right tabular-nums">
          {slider.format(sliderValue)}
        </span>
      </div>

      <div className="border-separator space-y-2 border-t pt-2">
        <div className="flex items-center justify-between">
          <span className="text-label text-footnote font-semibold">{props.colorLabel}</span>
          <span className="text-tint text-footnote font-mono">
            {color ? color.toUpperCase() : "Auto"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {COLOR_PRESETS.map((preset) => {
            const isActive = (color || "") === preset.value;
            return (
              <button
                key={`${colorKey}-${preset.id}`}
                type="button"
                title={preset.label}
                aria-label={preset.label}
                aria-pressed={isActive}
                onClick={() => onChange((p) => ({ ...p, [colorKey]: preset.value }))}
                className={cn(
                  "flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-[color,background-color,border-color,box-shadow,opacity,transform]",
                  preset.bgClass,
                  isActive
                    ? "ring-tint ring-offset-surface border-separator shadow-card scale-110 ring-2 ring-offset-2"
                    : "border-separator opacity-80 hover:opacity-100"
                )}
              />
            );
          })}
          <label
            className="border-separator bg-surface relative flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border transition-[color,background-color,border-color,box-shadow,opacity,transform]"
            title="Custom hex color"
          >
            <input
              type="color"
              value={color || "#f59e0b"}
              onChange={(e) => onChange((p) => ({ ...p, [colorKey]: e.target.value }))}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
            <Palette className="text-label-secondary h-3 w-3" />
          </label>
        </div>
      </div>
    </div>
  );
}

export const RackAppearanceSection = React.memo(function RackAppearanceSection({
  state,
  onChange,
  onOpenIconBrowser,
}: RackAppearanceSectionProps) {
  return (
    <div className="space-y-4">
      {/* Artwork subsection */}
      <div className="border-separator bg-fill-4 rounded-control space-y-3 border p-3">
        <div className="flex items-center justify-between">
          <div className="text-label text-footnote flex items-center gap-2 font-semibold">
            <ImageIcon className="text-tint h-4 w-4" />
            <span>Card artwork & media</span>
          </div>
          {state.artworkUrl && (
            <label className="text-label-secondary text-footnote flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={state.enableArtwork}
                onChange={(e) => onChange((p) => ({ ...p, enableArtwork: e.target.checked }))}
                className="accent-primary rounded-control-sm h-3.5 w-3.5"
              />
              <span>Show on card</span>
            </label>
          )}
        </div>

        {state.artworkUrl ? (
          <div className="border-separator bg-surface rounded-control flex items-center justify-between border p-2">
            <div className="flex min-w-0 items-center gap-2">
              <div className="bg-fill-3 border-separator rounded-control flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden border">
                <img
                  src={proxyCardArtwork(state.artworkUrl)}
                  alt="Artwork"
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-label text-footnote truncate font-semibold">
                  {state.artworkSource === "WIKI_FETCHED"
                    ? "Wiki Article Artwork"
                    : "Custom Artwork"}
                </div>
                <div className="text-label-secondary text-footnote truncate font-mono">
                  {state.artworkUrl}
                </div>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange((p) => ({ ...p, artworkUrl: null, enableArtwork: false }))}
              className="text-label-secondary hover:text-destructive text-footnote h-6 shrink-0 px-2"
            >
              Clear
            </Button>
          </div>
        ) : (
          <div>
            <label className="text-label-secondary text-footnote mb-1 block font-medium">
              Direct Image URL (or search via Lore Import)
            </label>
            <Input
              value={state.artworkUrl || ""}
              onChange={(e) =>
                onChange((p) => ({
                  ...p,
                  artworkUrl: e.target.value || null,
                  enableArtwork: Boolean(e.target.value),
                  artworkSource: "FLAG",
                }))
              }
              placeholder="https://..."
              className="text-footnote h-8 font-mono"
            />
          </div>
        )}

        {state.artworkUrl && state.enableArtwork && (
          <div className="flex items-center gap-3 pt-1">
            <span className="text-label-secondary text-footnote shrink-0 font-medium">
              Artwork opacity:
            </span>
            <input
              type="range"
              min="0.10"
              max="1.0"
              step="0.05"
              value={state.artworkOpacity ?? 0.85}
              onChange={(e) => onChange((p) => ({ ...p, artworkOpacity: Number(e.target.value) }))}
              className="bg-fill-3 accent-primary rounded-control h-1 flex-1"
            />
            <span className="text-label text-footnote w-8 text-right tabular-nums">
              {Math.round((state.artworkOpacity ?? 0.85) * 100)}%
            </span>
          </div>
        )}
      </div>

      {/* Icons and Sigils */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SigilPanel
          state={state}
          onChange={onChange}
          onBrowse={() => onOpenIconBrowser("emblem")}
          title="Primary icon"
          browseLabel="4,100+ Icons"
          defaultLabel={`Default ${getCategoryLabel(state.category)} Sigil`}
          iconKey="emblemIcon"
          colorKey="emblemColor"
          colorLabel="Emblem color"
          slider={{
            label: "Scale:",
            key: "emblemScale",
            min: "0.5",
            max: "1.5",
            format: (v) => `${v.toFixed(2)}x`,
          }}
        />

        <SigilPanel
          state={state}
          onChange={onChange}
          onBrowse={() => onOpenIconBrowser("watermark")}
          title="Background pattern"
          browseLabel="Open"
          defaultLabel={`Default ${getCategoryLabel(state.category)} Watermark`}
          iconKey="watermarkIcon"
          colorKey="watermarkColor"
          colorLabel="Watermark color"
          slider={{
            label: "Opacity:",
            key: "watermarkOpacity",
            min: "0.05",
            max: "0.70",
            format: (v) => `${Math.round(v * 100)}%`,
          }}
        />
      </div>

      {/* Custom Hue Override */}
      <div className="border-separator flex items-center justify-between border-t pt-2">
        <div>
          <span className="text-label text-footnote block font-medium">Custom hue override</span>
          <span className="text-label-secondary text-footnote">
            Overrides base material gradient hue
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={state.accentColorOverride || "#6366f1"}
            onChange={(e) => onChange((p) => ({ ...p, accentColorOverride: e.target.value }))}
            className="rounded-control h-8 w-8 cursor-pointer border-0 bg-transparent"
          />
          {state.accentColorOverride && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange((p) => ({ ...p, accentColorOverride: "" }))}
              className="text-label-secondary text-footnote h-6 px-2"
            >
              Reset
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});
