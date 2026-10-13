"use client";

import { createContext } from "react";

/**
 * Opens the Atlas import wizard on a job (an analysis the retry just started). Provided by the Atlas page; without a
 * provider (a realm's own page) the caller goes to `/admin/maps?importJob=<id>` instead.
 */
export const ImportLauncherContext = createContext<((jobId: string) => void) | null>(null);

export const importJobHref = (jobId: string) =>
  `/admin/maps?importJob=${encodeURIComponent(jobId)}`;
