"use client";

import { useState, type CSSProperties } from "react";
import { Refresh as RefreshCw } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { cn } from "~/lib/utils/cn";

type ThemeType = "standard" | "dark" | "paper";

const THEMES: ThemeType[] = ["standard", "dark", "paper"];

interface StyleEditorFrameProps {
  /** A fixed height (a number is pixels); without it the frame fills its parent */
  height?: number | string;
  className?: string;
}

/** The map style editor: a theme picker and reload above the Maputnik frame, which edits that theme's stored style. */
export function StyleEditorFrame({ height, className }: StyleEditorFrameProps) {
  const [selectedTheme, setSelectedTheme] = useState<ThemeType>("standard");
  const [key, setKey] = useState(0); // Key to force-reload the iframe when changing theme

  const handleThemeChange = (theme: ThemeType) => {
    setSelectedTheme(theme);
    setKey((prev) => prev + 1);
  };

  // Points to our local static Maputnik and references our style-store API
  const iframeUrl = `/admin/maputnik/index.html?style=/api/maps/style-store?theme=${selectedTheme}`;
  const style: CSSProperties | undefined = height === undefined ? undefined : { height };

  return (
    <div
      style={style}
      className={cn("bg-surface flex min-h-0 flex-col overflow-hidden", className)}
    >
      <div className="border-separator bg-surface flex h-12 shrink-0 items-center justify-between gap-3 border-b px-4">
        <SegmentedControl
          size="sm"
          aria-label="Map theme"
          value={selectedTheme}
          onValueChange={handleThemeChange}
          options={THEMES.map((theme) => ({
            value: theme,
            label: <span className="capitalize">{theme}</span>,
            "aria-label": theme,
          }))}
        />
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="w-7"
            onClick={() => setKey((prev) => prev + 1)}
            title="Reload style editor"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <div className="rounded-control-sm border-separator bg-surface-secondary text-caption text-label-secondary border px-2 py-0.5">
            Maputnik v1.7.0
          </div>
        </div>
      </div>
      <div className="bg-surface relative w-full flex-1">
        {/* oxlint-disable-next-line -- Maputnik admin editor requires scripts + same-origin for style-store API, trusted same-origin iframe */}
        <iframe
          key={key}
          src={iframeUrl}
          sandbox="allow-scripts allow-same-origin"
          className="bg-surface absolute inset-0 h-full w-full border-none"
          title="Maputnik visual style editor"
        />
      </div>
    </div>
  );
}
