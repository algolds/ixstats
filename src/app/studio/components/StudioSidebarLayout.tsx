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
      {/* Mobile horizontal nav — sits cleanly below mobile nav */}
      <div className="sticky top-14 z-30 border-b border-white/10 bg-slate-900/90 px-4 py-2 backdrop-blur-lg lg:hidden">
        <div className="flex scrollbar-none gap-2 overflow-x-auto">
          <StudioSidebarNav
            activeSection={activeSection}
            onNavigate={onNavigate}
            completedSections={completedSections}
          />
        </div>
      </div>

      {/* Desktop grid layout */}
      <div className="mx-auto min-h-screen max-w-[1920px] lg:grid lg:grid-cols-[280px_1fr] lg:gap-0">
        {/* Sidebar — docked cleanly below 64px navbar */}
        <aside className="hidden border-r border-white/10 bg-slate-900/50 backdrop-blur-sm lg:sticky lg:top-16 lg:flex lg:h-[calc(100vh-4rem)] lg:flex-col">
          {/* Logo */}
          <div className="border-b border-white/10 p-6">
            <h1 className="text-xl font-bold tracking-tight text-white">World Studio</h1>
            <p className="mt-1 text-xs text-white/40">Realm Creator</p>
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
          {sidebarExtra && <div className="border-t border-white/10 p-4">{sidebarExtra}</div>}
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
