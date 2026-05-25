"use client";

import type { ProjectionMode } from "~/lib/map-config";
import { PROJECTION_MODES } from "~/lib/map-config";

interface ProjectionToggleProps {
  projectionMode: ProjectionMode;
  onProjectionChange: (mode: ProjectionMode) => void;
}

/** Inline SVG icons for each projection mode */
const ICONS: Record<ProjectionMode, React.ReactNode> = {
  dynamic: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
      />
    </svg>
  ),
  globe: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10A15.3 15.3 0 0112 2z" />
    </svg>
  ),
  mercator: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <path strokeLinecap="round" d="M3 12h18M12 5v14" />
    </svg>
  ),
};

export function ProjectionToggle({ projectionMode, onProjectionChange }: ProjectionToggleProps) {
  return (
    <div className="bg-card ring-border absolute top-[120px] right-[10px] z-10 flex flex-col overflow-hidden rounded-md shadow-md ring-1">
      {PROJECTION_MODES.map(({ mode, title }) => {
        const isActive = projectionMode === mode;
        return (
          <button
            key={mode}
            onClick={() => onProjectionChange(mode)}
            className={`border-border flex h-[29px] w-[29px] items-center justify-center border-b transition-colors last:border-b-0 ${
              isActive
                ? "bg-blue-500 text-white"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
            title={title}
          >
            {ICONS[mode]}
          </button>
        );
      })}
    </div>
  );
}
