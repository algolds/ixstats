"use client";

import { useEffect } from "react";
import { markVersionSeen } from "~/lib/navigation/seen-version";

/** Opening the changelog is what clears the sidebar's "What's new" flag for this build. */
export function MarkVersionSeen() {
  useEffect(() => {
    markVersionSeen();
  }, []);
  return null;
}
