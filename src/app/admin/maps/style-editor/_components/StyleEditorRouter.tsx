"use client";

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
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-900 text-white">
      {/* Top Header Bar */}
      <header className="flex h-12 items-center justify-between border-b border-slate-800 bg-slate-950 px-4">
        {/* Left Section: Back button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              window.location.href = "/admin/maps";
            }}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
            title="Return to Admin Maps Settings"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Exit Editor</span>
          </button>

          <div className="h-4 w-px bg-slate-800" />

          <div className="flex items-center gap-2">
            <Layers className="h-4.5 w-4 text-blue-400" />
            <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
              Style Editor
            </span>
          </div>
        </div>

        {/* Middle Section: Theme Selector Buttons */}
        <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1">
          {(["standard", "dark", "paper"] as ThemeType[]).map((theme) => (
            <button
              key={theme}
              onClick={() => handleThemeChange(theme)}
              className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-all ${
                selectedTheme === theme
                  ? "bg-blue-600 text-white shadow"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              {theme}
            </button>
          ))}
        </div>

        {/* Right Section: Info & Reload */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setKey((prev) => prev + 1)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            title="Reload Style Editor"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          <div className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
            Maputnik v1.7.0
          </div>
        </div>
      </header>

      {/* Embedded Maputnik Iframe */}
      <div className="relative w-full flex-1 bg-slate-900">
        {/* oxlint-disable-next-line -- Maputnik admin editor requires scripts + same-origin for style-store API, trusted same-origin iframe */}
        <iframe
          key={key}
          src={iframeUrl}
          sandbox="allow-scripts allow-same-origin"
          className="absolute inset-0 h-full w-full border-none bg-slate-900"
          title="Maputnik Visual Style Editor"
        />
      </div>
    </div>
  );
}
