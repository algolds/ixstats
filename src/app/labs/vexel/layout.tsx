"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";
import { VexelEditorSkeleton } from "~/components/maps/vexel/VexelEditor";

export default function VexelLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<VexelEditorSkeleton />}>{children}</Suspense>;
}
