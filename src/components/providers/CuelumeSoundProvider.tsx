"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { initializeSoundEngine, soundCues } from "~/lib/sound/cuelume";

/**
 * Bootstraps Cuelume (persisted volume/enabled state) and plays the page-arrival cue, subtle, on
 * client-side route changes (single-page routers switch sections often). Muting (the sound
 * toggle, `data-sound="off"`, `data-motion="reduced"`) is enforced at play time by
 * `~/lib/sound/cuelume`. Renders nothing — mount it once in the root layout.
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
    soundCues?.arrival?.("subtle");
  }, [pathname]);

  return null;
}
