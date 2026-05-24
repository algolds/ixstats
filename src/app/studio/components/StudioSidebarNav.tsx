"use client";

import React from "react";
import { SECTION_THEMES, type StudioSection, STUDIO_SECTIONS } from "../lib/studio-theme";

interface StudioSidebarNavProps {
  activeSection: StudioSection;
  onNavigate: (section: StudioSection) => void;
  completedSections?: Set<StudioSection>;
}

export function StudioSidebarNav({
  activeSection,
  onNavigate,
  completedSections = new Set(),
}: StudioSidebarNavProps) {
  return (
    <nav className="flex flex-col gap-1">
      {STUDIO_SECTIONS.map((sectionId) => {
        const theme = SECTION_THEMES[sectionId];
        const isActive = activeSection === sectionId;
        const isCompleted = completedSections.has(sectionId);

        return (
          <button
            key={sectionId}
            onClick={() => onNavigate(sectionId)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all duration-200 ${
              isActive
                ? "border border-white/20 bg-white/10 shadow-sm backdrop-blur-sm"
                : "border border-transparent hover:bg-white/5"
            } `}
          >
            <span className="shrink-0 text-lg">{theme.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-medium ${isActive ? "text-white" : "text-white/70"}`}
                >
                  {theme.label}
                </span>
                {isCompleted && <span className="text-xs text-emerald-400">✓</span>}
              </div>
              <span className="block truncate text-xs text-white/40">{theme.description}</span>
            </div>
          </button>
        );
      })}
    </nav>
  );
}
