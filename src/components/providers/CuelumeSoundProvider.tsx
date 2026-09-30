"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { initializeSoundEngine, soundCues } from "~/lib/sound/cuelume";

/**
 * Bootstraps Cuelume (persisted volume/enabled state and the delegated listeners) and plays the
 * page-arrival cue on client-side route changes — one of the §9 moments. Muting (the sound
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
    soundCues?.arrival?.();
  }, [pathname]);

  return null;
}
