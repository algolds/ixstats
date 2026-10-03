"use client";
// src/app/admin/image-repo/ImageRepoPanel.tsx
// WikiOS Commons Repository Cache Admin Panel

import { usePageTitle } from "~/hooks/usePageTitle";
import { PageHeader } from "~/components/shell/PageHeader";

import { UnifiedMediaServiceAdmin } from "../_components/UnifiedMediaServiceAdmin";

export function ImageRepoPanel() {
  usePageTitle({ title: "Admin - Image Repository" });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commons image cache"
        subtitle="Sync Wikimedia Commons images, build SVG flag caches and check CDN assets."
      />

      <UnifiedMediaServiceAdmin />
    </div>
  );
}

export default ImageRepoPanel;
