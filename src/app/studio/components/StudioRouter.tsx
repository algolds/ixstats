"use client";

import React, { useEffect, useCallback, Suspense } from "react";
import dynamic from "next/dynamic";
import { StudioSidebarLayout } from "./StudioSidebarLayout";
import { StudioSectionHero } from "./StudioSectionHero";
import { StudioStateProvider, useStudioState } from "../context/StudioStateContext";
import { getSectionFromPathname } from "../lib/studio-theme";

// Lazy-load sections to keep bundle small
const DashboardSection = dynamic(
  () => import("./sections/DashboardSection").then((m) => ({ default: m.DashboardSection })),
  { ssr: false }
);
const CreateSection = dynamic(
  () => import("./sections/CreateSection").then((m) => ({ default: m.CreateSection })),
  { ssr: false }
);
const TerrainSection = dynamic(
  () => import("./sections/TerrainSection").then((m) => ({ default: m.TerrainSection })),
  { ssr: false }
);
const ClimateSection = dynamic(
  () => import("./sections/ClimateSection").then((m) => ({ default: m.ClimateSection })),
  { ssr: false }
);
const NationsSection = dynamic(
  () => import("./sections/NationsSection").then((m) => ({ default: m.NationsSection })),
  { ssr: false }
);
const PopulateSection = dynamic(
  () => import("./sections/PopulateSection").then((m) => ({ default: m.PopulateSection })),
  { ssr: false }
);
const EconomicsSection = dynamic(
  () => import("./sections/EconomicsSection").then((m) => ({ default: m.EconomicsSection })),
  { ssr: false }
);
const PreviewSection = dynamic(
  () => import("./sections/PreviewSection").then((m) => ({ default: m.PreviewSection })),
  { ssr: false }
);
const PublishSection = dynamic(
  () => import("./sections/PublishSection").then((m) => ({ default: m.PublishSection })),
  { ssr: false }
);

function SectionLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="animate-pulse text-sm text-white/40">Loading section...</div>
    </div>
  );
}

function StudioRouterInner() {
  const { state, navigateTo } = useStudioState();
  const { step, realmName, completedSections, generationProgress } = state;

  // Sync URL → state on mount and popstate
  useEffect(() => {
    const handlePopState = () => {
      const section = getSectionFromPathname(window.location.pathname);
      navigateTo(section);
    };

    // Initial sync
    const initial = getSectionFromPathname(window.location.pathname);
    if (initial !== step) {
      navigateTo(initial);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderSection = useCallback(() => {
    switch (step) {
      case "dashboard":
        return <DashboardSection />;
      case "create":
        return <CreateSection />;
      case "terrain":
        return <TerrainSection />;
      case "climate":
        return <ClimateSection />;
      case "nations":
        return <NationsSection />;
      case "populate":
        return <PopulateSection />;
      case "economics":
        return <EconomicsSection />;
      case "preview":
        return <PreviewSection />;
      case "publish":
        return <PublishSection />;
      default:
        return <DashboardSection />;
    }
  }, [step]);

  return (
    <StudioSidebarLayout
      activeSection={step}
      onNavigate={navigateTo}
      completedSections={completedSections}
    >
      <StudioSectionHero
        section={step}
        realmName={realmName || undefined}
        progress={step !== "dashboard" ? generationProgress : undefined}
      />
      <div className="p-6 lg:p-8">
        <Suspense fallback={<SectionLoader />}>{renderSection()}</Suspense>
      </div>
    </StudioSidebarLayout>
  );
}

export function StudioRouter() {
  return (
    <StudioStateProvider>
      <StudioRouterInner />
    </StudioStateProvider>
  );
}
