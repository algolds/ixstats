"use client";

import React, { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { initializeSoundEngine, soundEffects } from "~/lib/sound/cuelume";

/**
 * CuelumeSoundProvider
 *
 * Bootstraps Cuelume's delegated Web Audio listeners onto the document and
 * listens to client-side route arrivals with subtle Apple Design audio cues.
 */
export function CuelumeSoundProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const initialMountRef = useRef(true);

  useEffect(() => {
    initializeSoundEngine();
  }, []);

  // Subtle arrival sound when navigating between top-level sections
  useEffect(() => {
    if (initialMountRef.current) {
      initialMountRef.current = false;
      return;
    }
    // Fire subtle arrival sound on route transition
    soundEffects.arrival();
  }, [pathname]);

  return <>{children}</>;
}
