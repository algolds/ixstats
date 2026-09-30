"use client";

/**
 * Settings › Appearance & accessibility (Facet 3 spec §1, §9, §10).
 *
 * Every control writes through ThemeProvider (`~/context/theme-context`) or the Cuelume mute toggle
 * (`useSoundSettings`), so changes apply to `<html>` immediately and persist under the same
 * localStorage keys the pre-paint script reads (`APPEARANCE_STORAGE_KEYS`).
 *
 * Accessibility switches are "Follow system" when off: the OS preference (prefers-contrast,
 * prefers-reduced-transparency, prefers-reduced-motion) still applies; on forces the setting.
 */

import { useId, type ReactNode } from "react";
import {
  SunLight,
  HalfMoon,
  ModernTv,
  TextSize,
  DropletHalf,
  ViewGrid,
  Flash,
  SoundHigh,
  SoundLow,
  Component,
  Compress,
  CursorPointer,
} from "iconoir-react";
import { useTheme, type Theme } from "~/context/theme-context";
import { useSoundSettings } from "~/hooks/useSoundSettings";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Switch } from "~/components/ui/switch";
import { Slider } from "~/components/ui/slider";
import { Eyebrow } from "~/components/ui/eyebrow";
import { TEXT_SCALE_MAX, TEXT_SCALE_MIN } from "~/lib/design/appearance";
import { SettingsHeader } from "../SettingsHeader";

const THEME_OPTIONS = [
  { value: "system", label: "System", icon: <ModernTv aria-hidden /> },
  { value: "light", label: "Light", icon: <SunLight aria-hidden /> },
  { value: "dark", label: "Dark", icon: <HalfMoon aria-hidden /> },
] as const satisfies readonly { value: Theme; label: string; icon: ReactNode }[];

const DENSITY_OPTIONS = [
  { value: "regular", label: "Regular" },
  { value: "compact", label: "Compact" },
] as const;

const followSystem = (on: boolean) => (on ? "On" : "Follows your system setting");

function PreferenceSwitch({
  label,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Switch
      aria-label={label}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
    />
  );
}

export function AppearanceAccessibilityPanel() {
  const {
    theme,
    setTheme,
    compactMode,
    setCompactMode,
    textScale,
    setTextScale,
    increaseContrast,
    setIncreaseContrast,
    reduceTransparency,
    setReduceTransparency,
    reduceAnimations,
    setReduceAnimations,
    enableTextures,
    setEnableTextures,
    lowFidelityMode,
    setLowFidelityMode,
    interactiveHover,
    setInteractiveHover,
  } = useTheme();
  const sound = useSoundSettings();
  const textSizeLabelId = useId();
  const volumeLabelId = useId();

  const textPercent = Math.round(textScale * 100);
  const volumePercent = Math.round(sound.volume * 100);

  return (
    <div className="flex flex-col gap-6">
      <SettingsHeader
        title="Appearance & accessibility"
        category="Platform & Preferences"
        description="Theme, density, text size, contrast, transparency, motion and sound. Changes apply immediately on this device."
      />

      <FacetList>
        <FacetListSection header="Appearance">
          <FacetRow
            leading={<SunLight className="size-5" />}
            title="Theme"
            subtitle="System follows your device's light or dark setting."
            trailing={
              <SegmentedControl
                aria-label="Theme"
                size="sm"
                value={theme}
                onValueChange={setTheme}
                options={THEME_OPTIONS}
              />
            }
          />
          <FacetRow
            leading={<Compress className="size-5" />}
            title="Density"
            subtitle="Compact tightens spacing and control heights; text size is unchanged."
            trailing={
              <SegmentedControl
                aria-label="Density"
                size="sm"
                value={compactMode ? "compact" : "regular"}
                onValueChange={(value) => setCompactMode(value === "compact")}
                options={DENSITY_OPTIONS}
              />
            }
          />
          <li className="flex list-none items-start pl-4">
            <TextSize aria-hidden className="my-3 mr-3 size-5 shrink-0 text-label-secondary" />
            <div className="flex min-w-0 flex-1 flex-col gap-3 border-t border-separator py-3 pr-4">
              <div className="flex items-center gap-3">
                <span id={textSizeLabelId} className="flex-1 text-headline text-label">
                  Text size
                </span>
                <span className="text-body text-label-secondary tabular-nums" aria-hidden>
                  {textPercent}%
                </span>
              </div>
              <div role="group" aria-labelledby={textSizeLabelId} className="flex items-center gap-3">
                <span aria-hidden className="text-footnote text-label-secondary">
                  A
                </span>
                <Slider
                  data-testid="text-size-slider"
                  min={Math.round(TEXT_SCALE_MIN * 100)}
                  max={Math.round(TEXT_SCALE_MAX * 100)}
                  step={5}
                  value={[textPercent]}
                  onValueChange={([value]) => {
                    if (value !== undefined) setTextScale(value / 100);
                  }}
                />
                <span aria-hidden className="text-title-3 text-label-secondary">
                  A
                </span>
              </div>
              {/* Live preview — text styles scale with --text-scale, so this tracks the slider. */}
              <div className="flex flex-col gap-1 rounded-row bg-surface-secondary p-3">
                <Eyebrow>Preview</Eyebrow>
                <span className="text-title-3 text-label">Quarterly budget</span>
                <span className="text-body text-label-secondary">
                  Text across IxStats is shown at {textPercent}% of the default size.
                </span>
              </div>
            </div>
          </li>
        </FacetListSection>

        <FacetListSection
          header="Accessibility"
          footer="When a switch is off, IxStats follows the matching setting on your device."
        >
          <FacetRow
            leading={<DropletHalf className="size-5" />}
            title="Increase contrast"
            subtitle={followSystem(increaseContrast)}
            trailing={
              <PreferenceSwitch
                label="Increase contrast"
                checked={increaseContrast}
                onCheckedChange={setIncreaseContrast}
              />
            }
          />
          <FacetRow
            leading={<ViewGrid className="size-5" />}
            title="Reduce transparency"
            subtitle={followSystem(reduceTransparency)}
            trailing={
              <PreferenceSwitch
                label="Reduce transparency"
                checked={reduceTransparency}
                onCheckedChange={setReduceTransparency}
              />
            }
          />
          <FacetRow
            leading={<Flash className="size-5" />}
            title="Reduce motion"
            subtitle={
              reduceAnimations
                ? "On — springs become short fades and sound effects are muted"
                : followSystem(false)
            }
            trailing={
              <PreferenceSwitch
                label="Reduce motion"
                checked={reduceAnimations}
                onCheckedChange={setReduceAnimations}
              />
            }
          />
        </FacetListSection>

        <FacetListSection
          header="Sound"
          footer="Sound plays only for meaningful moments: success, errors, confirmations, sheets and dialogs, Vault reveals, notifications and arriving on a page."
        >
          <FacetRow
            leading={<SoundHigh className="size-5" />}
            title="Sound effects"
            subtitle={
              reduceAnimations && sound.enabled ? "Muted while Reduce motion is on" : undefined
            }
            trailing={
              <PreferenceSwitch
                label="Sound effects"
                checked={sound.enabled}
                onCheckedChange={sound.setEnabled}
              />
            }
          />
          <li className="flex list-none items-start pl-4">
            <SoundLow aria-hidden className="my-3 mr-3 size-5 shrink-0 text-label-secondary" />
            <div className="flex min-w-0 flex-1 flex-col gap-2 border-t border-separator py-3 pr-4">
              <div className="flex items-center gap-3">
                <span id={volumeLabelId} className="flex-1 text-headline text-label">
                  Volume
                </span>
                <span className="text-body text-label-secondary tabular-nums" aria-hidden>
                  {volumePercent}%
                </span>
              </div>
              <div role="group" aria-labelledby={volumeLabelId}>
                <Slider
                  data-testid="volume-slider"
                  min={0}
                  max={100}
                  step={5}
                  value={[volumePercent]}
                  disabled={!sound.enabled}
                  onValueChange={([value]) => {
                    if (value !== undefined) sound.setVolume(value / 100);
                  }}
                  onValueCommit={() => sound.previewSound("success")}
                />
              </div>
            </div>
          </li>
        </FacetListSection>

        <FacetListSection header="Visual effects">
          <FacetRow
            leading={<Component className="size-5" />}
            title="Texture overlays"
            subtitle="Subtle dot and grid textures on empty states and heroes"
            trailing={
              <PreferenceSwitch
                label="Texture overlays"
                checked={enableTextures}
                onCheckedChange={setEnableTextures}
              />
            }
          />
          <FacetRow
            leading={<Flash className="size-5" />}
            title="Low fidelity mode"
            subtitle="Turns off backdrop blur for maximum browser performance"
            trailing={
              <PreferenceSwitch
                label="Low fidelity mode"
                checked={lowFidelityMode}
                onCheckedChange={setLowFidelityMode}
              />
            }
          />
          <FacetRow
            leading={<CursorPointer className="size-5" />}
            title="Hover highlight"
            subtitle="A soft highlight follows the pointer over cards"
            trailing={
              <PreferenceSwitch
                label="Hover highlight"
                checked={interactiveHover}
                onCheckedChange={setInteractiveHover}
              />
            }
          />
        </FacetListSection>
      </FacetList>
    </div>
  );
}
