"use client";
// src/app/admin/image-repo/ImageRepoPanel.tsx
// WikiOS Commons Repository Cache Admin Panel

import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "../_components/AdminHeader";
import { MediaImage as ImageIcon } from "iconoir-react";
import { UnifiedMediaServiceAdmin } from "../_components/UnifiedMediaServiceAdmin";

export function ImageRepoPanel() {
  usePageTitle({ title: "Admin - Image Repository" });

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={ImageIcon}
        title="WikiOS Commons Repository Cache"
        description="Synchronize Wikimedia Commons graphics, initialize SVG flag caches, and verify CDN assets."
      />

      <UnifiedMediaServiceAdmin />
    </div>
  );
}

export default ImageRepoPanel;
