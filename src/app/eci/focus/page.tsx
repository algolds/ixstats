"use client";
export const dynamic = 'force-dynamic';
import { useState } from "react";
import { EconomicFocus } from "@/components/eci/focus/EconomicFocus";
import { DemographicsFocus } from "@/components/eci/focus/DemographicsFocus";
import { GovernmentFocus } from "@/components/eci/focus/GovernmentFocus";
import { DiplomaticFocus } from "@/components/eci/focus/DiplomaticFocus";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";

const FOCUS_AREAS = [
  { key: "economic", label: "Economic", icon: "💰" },
  { key: "demographics", label: "Demographics", icon: "👥" },
  { key: "government", label: "Government", icon: "🏛️" },
  { key: "diplomatic", label: "Diplomatic", icon: "🤝" },
];

export default function FocusModulePage() {
  const [selected, setSelected] = useState("economic");
  const [transitioning, setTransitioning] = useState(false);

  // Animate fade/slide on tab switch
  function handleTabChange(key: string) {
    if (key === selected) return;
    setTransitioning(true);
    setTimeout(() => {
      setSelected(key);
      setTransitioning(false);
    }, 180); // match transition duration
  }

  return (
    <>
      <SignedIn>
        <div className="max-w-6xl mx-auto w-full py-8 animate-fade-in px-2 md:px-0">
          {/* Section Header */}
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl md:text-4xl bg-gradient-to-br from-blue-400 to-purple-500 bg-clip-text text-transparent drop-shadow-lg">🏯</span>
            <h1 className="text-2xl md:text-3xl font-bold text-blue-100 tracking-tight">Focus Areas</h1>
            <span className="ml-2 text-blue-400 text-sm md:text-base font-medium bg-blue-900/30 px-3 py-1 rounded-full border border-blue-700/30">Live Analytics</span>
          </div>
          {/* Sticky Tab Bar */}
          <div className="sticky top-2 z-30 flex justify-center mb-8">
            <nav
              className="flex gap-2 bg-black/30 rounded-2xl p-2 shadow-lg backdrop-blur-md border border-blue-900/30 w-full max-w-2xl mx-auto"
              role="tablist"
              aria-label="Focus Area Tabs"
            >
              {FOCUS_AREAS.map((area) => (
                <button
                  key={area.key}
                  className={`px-5 py-2 rounded-xl font-semibold flex items-center gap-2 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60
                    ${selected === area.key
                      ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg scale-105"
                      : "bg-transparent text-blue-200 hover:bg-blue-800/20 hover:text-white"}
                  `}
                  aria-selected={selected === area.key}
                  aria-controls={`focus-panel-${area.key}`}
                  tabIndex={selected === area.key ? 0 : -1}
                  onClick={() => handleTabChange(area.key)}
                  type="button"
                  role="tab"
                >
                  <span className="text-lg md:text-xl" aria-hidden="true">{area.icon}</span>
                  <span>{area.label}</span>
                </button>
              ))}
            </nav>
          </div>
          {/* Animated Glassy Card Container */}
          <div
            className={`transition-all duration-200 ${transitioning ? 'opacity-0 translate-y-4 pointer-events-none' : 'opacity-100 translate-y-0'}
              bg-gradient-to-br from-blue-900/40 to-purple-900/30 rounded-3xl shadow-2xl border border-blue-800/30 backdrop-blur-xl p-2 md:p-6 min-h-[60vh]`}
            id={`focus-panel-${selected}`}
            role="tabpanel"
            aria-labelledby={`focus-tab-${selected}`}
          >
            {selected === "economic" && <EconomicFocus />}
            {selected === "demographics" && <DemographicsFocus />}
            {selected === "government" && <GovernmentFocus />}
            {selected === "diplomatic" && <DiplomaticFocus />}
          </div>
        </div>
      </SignedIn>
      <SignedOut>
        <div className="flex flex-col items-center justify-center min-h-screen">
          <SignInButton mode="modal" />
        </div>
      </SignedOut>
    </>
  );
} 