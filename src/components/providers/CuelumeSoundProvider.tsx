"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { initializeSoundEngine, soundEffects } from "~/lib/sound/cuelume";

/**
 * Bootstraps Cuelume's delegated Web Audio listeners on the document and plays a
 * subtle arrival cue on client-side route changes. Renders nothing — mount it once
 * as a sibling in the root layout (it is an effect, not a context provider).
 */
export function CuelumeSoundProvider() {
  const pathname = usePathname();
  const initialMountRef = useRef(true);

  useEffect(() => {
    initializeSoundEngine();
  }, []);

  useEffect(() => {
    if (initialMountRef.current) {
      initialMountRef.current = false;
      return;
    }
    soundEffects.arrival();
    // oxlint-disable-next-line
  }, [pathname]);

  return null;
}
