// src/app/(wiki-os)/wiki/page.tsx
// WikiOS Main Page entry point
"use client";

import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { WikiOSMainPage } from "~/components/wiki-os/reader/WikiOSMainPage";

export default function WikiIndexPage() {
  return (
    <WikiOSLayout>
      <WikiOSMainPage />
    </WikiOSLayout>
  );
}
