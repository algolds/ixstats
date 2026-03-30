"use client";

import React, { type ReactNode } from "react";
import { StudioSidebarNav } from "./StudioSidebarNav";
import type { StudioSection } from "../lib/studio-theme";

interface StudioSidebarLayoutProps {
  children: ReactNode;
  activeSection: StudioSection;
  onNavigate: (section: StudioSection) => void;
  completedSections?: Set<StudioSection>;
  sidebarExtra?: ReactNode;
}

export function StudioSidebarLayout({
  children,
  activeSection,
  onNavigate,
  completedSections,
  sidebarExtra,
}: StudioSidebarLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Mobile horizontal nav */}
      <div className="lg:hidden sticky top-0 z-30 bg-slate-900/90 backdrop-blur-lg border-b border-white/10 px-4 py-2">
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          <StudioSidebarNav
            activeSection={activeSection}
            onNavigate={onNavigate}
            completedSections={completedSections}
          />
        </div>
      </div>

      {/* Desktop grid layout */}
      <div className="max-w-[1920px] mx-auto lg:grid lg:grid-cols-[280px_1fr] lg:gap-0 min-h-screen">
        {/* Sidebar */}
        <aside className="hidden lg:flex lg:flex-col lg:sticky lg:top-0 lg:h-screen border-r border-white/10 bg-slate-900/50 backdrop-blur-sm">
          {/* Logo */}
          <div className="p-6 border-b border-white/10">
            <h1 className="text-xl font-bold text-white tracking-tight">
              World Studio
            </h1>
            <p className="text-xs text-white/40 mt-1">Realm Creator</p>
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto p-4">
            <StudioSidebarNav
              activeSection={activeSection}
              onNavigate={onNavigate}
              completedSections={completedSections}
            />
          </div>

          {/* Extra sidebar content */}
          {sidebarExtra && (
            <div className="p-4 border-t border-white/10">
              {sidebarExtra}
            </div>
          )}
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
