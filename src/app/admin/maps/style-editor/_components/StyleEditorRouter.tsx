"use client";

import { SegmentedControl } from "~/components/ui/segmented-control";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Button } from "~/components/ui/button";
import { useState } from "react";
import { ArrowLeft, Refresh as RefreshCw, Component as Layers } from "iconoir-react";

type ThemeType = "standard" | "dark" | "paper";

export function StyleEditorRouter() {
  const [selectedTheme, setSelectedTheme] = useState<ThemeType>("standard");
  const [key, setKey] = useState(0); // Key to force-reload the iframe when changing theme

  const handleThemeChange = (theme: ThemeType) => {
    setSelectedTheme(theme);
    setKey((prev) => prev + 1); // Increment key to force iframe reload
  };

  // Construct iframe URL: points to our local static Maputnik and references our style-store API
  const iframeUrl = `/admin/maputnik/index.html?style=/api/maps/style-store?theme=${selectedTheme}`;

  return (
    <div className="bg-surface text-label flex h-screen w-screen flex-col overflow-hidden">
      {/* Top Header Bar */}
      <header className="border-separator bg-surface flex h-12 items-center justify-between border-b px-4">
        {/* Left Section: Back button */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              window.location.href = "/admin/maps";
            }}
            title="Return to admin maps settings"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Exit editor</span>
          </Button>

          <div className="bg-surface-secondary h-4 w-px" />

          <div className="flex items-center gap-2">
            <Layers className="text-blue h-4.5 w-4" />
            <Eyebrow>Style editor</Eyebrow>
          </div>
        </div>

        {/* Middle Section: Theme Selector Buttons */}
        <SegmentedControl
          size="sm"
          aria-label="Map theme"
          value={selectedTheme}
          onValueChange={(theme) => handleThemeChange(theme)}
          options={(["standard", "dark", "paper"] as ThemeType[]).map((theme) => ({
            value: theme,
            label: <span className="capitalize">{theme}</span>,
            "aria-label": theme,
          }))}
        />

        {/* Right Section: Info & Reload */}
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
      </header>

      {/* Embedded Maputnik Iframe */}
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
