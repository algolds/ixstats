"use client";

import React from "react";
import { GeographyContent } from "../GeographyContent";

/**
 * GeographyTab — wrapper for the MyCountry tab system.
 *
 * Forwards to the existing `GeographyContent` (which now lives under
 * the Overview page after the Government tab, instead of as a top-level
 * sidebar section). The rollup settings are exposed via a settings
 * dialog inside the content body.
 */
export function GeographyTab() {
  return <GeographyContent />;
}
