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
            className={`
              flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200
              ${isActive
                ? "bg-white/10 backdrop-blur-sm border border-white/20 shadow-sm"
                : "hover:bg-white/5 border border-transparent"
              }
            `}
          >
            <span className="text-lg shrink-0">{theme.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-medium ${isActive ? "text-white" : "text-white/70"}`}
                >
                  {theme.label}
                </span>
                {isCompleted && (
                  <span className="text-xs text-emerald-400">✓</span>
                )}
              </div>
              <span className="text-xs text-white/40 truncate block">
                {theme.description}
              </span>
            </div>
          </button>
        );
      })}
    </nav>
  );
}
