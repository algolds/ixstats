// src/app/(wikios)/wiki-special/images/page.tsx
// WikiOS Image Browser — visual search across IxWiki + Wikimedia Commons.

"use client";

import { WikiOSLayout } from "~/components/wikios/shared/WikiOSLayout";
import { ImageSearchGrid } from "~/components/wikios/editor/ImageSearchGrid";
import { Image as ImageIcon, Database, Globe } from "lucide-react";

export default function ImagesPage() {
  return (
    <WikiOSLayout>
      <div className="wikios-special-page wikios-images-page">
        {/* Hero */}
        <div className="wikios-imgs-hero">
          <div className="wikios-imgs-hero-icon">
            <ImageIcon size={28} />
          </div>
          <div className="wikios-imgs-hero-text">
            <h1 className="wikios-imgs-hero-title">Image Browser</h1>
            <p className="wikios-imgs-hero-subtitle">
              Search and browse images from IxWiki and Wikimedia Commons. Click any image to view details or copy the wikitext embed code.
            </p>
          </div>
          <div className="wikios-imgs-hero-stats">
            <div className="wikios-imgs-hero-stat">
              <Database size={14} />
              <span>IxWiki</span>
            </div>
            <div className="wikios-imgs-hero-stat">
              <Globe size={14} />
              <span>Commons</span>
            </div>
          </div>
        </div>

        <ImageSearchGrid />
      </div>
    </WikiOSLayout>
  );
}
