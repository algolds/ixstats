"use client";

import React from "react";
import { SECTION_THEMES, type StudioSection } from "../lib/studio-theme";

interface StudioSectionHeroProps {
  section: StudioSection;
  realmName?: string;
  progress?: number;
}

export function StudioSectionHero({ section, realmName, progress }: StudioSectionHeroProps) {
  const theme = SECTION_THEMES[section];

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-r ${theme.gradient} px-6 py-8 lg:px-8 lg:py-10`}
    >
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%),
              radial-gradient(circle at 80% 20%, rgba(255,255,255,0.05) 0%, transparent 40%)`,
          }}
        />
      </div>

      <div className="relative z-10">
        <div className="mb-2 flex items-center gap-3">
          <span className="text-3xl">{theme.icon}</span>
          <div>
            <h2 className="text-2xl font-bold text-white">{theme.label}</h2>
            <p className="text-sm text-white/60">{theme.description}</p>
          </div>
        </div>

        {realmName && (
          <p className="mt-2 text-sm text-white/50">
            Editing: <span className="font-medium text-white/80">{realmName}</span>
          </p>
        )}

        {progress !== undefined && (
          <div className="mt-4 max-w-md">
            <div className="mb-1 flex justify-between text-xs text-white/50">
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-white/40 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
