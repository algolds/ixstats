"use client";

import { pageEditHref } from "~/lib/wiki-os/page-tools";
import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import type { DossierTabProps } from "~/types/dossier";
import { useDossier } from "~/hooks/useDossier";
import { WikiHeader } from "./dossier/WikiHeader";
import { WikiSectionCard } from "./dossier/WikiSectionCard";
import { DossierTocSidebar, type TocItem } from "./dossier/DossierTocSidebar";
import WikiContentModal from "./dossier/WikiContentModal";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import {
  WarningTriangle as AlertTriangle,
  Refresh as RefreshCw,
  OpenBook as BookOpen,
} from "iconoir-react";
import { resolveImageUrl } from "~/lib/wiki-os/adapters/ixstates/unified-parser";
import Link from "next/link";
import { NativeLoreCanvasModal } from "./dossier/NativeLoreCanvasModal";
import { NativeLoreView } from "./NativeLoreView";
import { useNativeLore, type LoreDraft } from "./useNativeLore";
import { Card, CardContent } from "~/components/ui/card";
import { titleToWikiOSRoute } from "~/lib/wiki-os/transformers/url-compat";

/**
 * DossierTab Component
 *
 * Displays national dossier data for a country with two primary modes:
 * - Sections (Wiki Synced Dossier): Main wiki content organized by topic
 * - Native Lore: Custom canvas documents & file imports
 */
export const DossierTab: React.FC<DossierTabProps> = ({
  countryName,
  countryData,
  viewerClearanceLevel = "PUBLIC",
  flagColors = { primary: "#3b82f6", secondary: "#6366f1", accent: "#8b5cf6" },
}) => {
  const router = useRouter();

  // State for active view
  const [activeView, setActiveView] = useState<"sections" | "native_lore">("sections");

  // State for collapsible sections
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  const toggleSection = (id: string) => setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));

  const { docs: nativeDocs, saveDoc, importSections, deleteDoc } = useNativeLore(countryName);
  const [isCanvasModalOpen, setIsCanvasModalOpen] = useState(false);
  const [editingLoreDoc, setEditingLoreDoc] = useState<(LoreDraft & { id?: string }) | null>(null);

  const openCanvas = (doc: (LoreDraft & { id?: string }) | null) => {
    setEditingLoreDoc(doc);
    setIsCanvasModalOpen(true);
  };

  // State for content modal (full-screen section reading)
  const [modalSection, setModalSection] = useState<{
    title: string;
    content: string;
    id: string;
    sourcePage?: string;
  } | null>(null);

  // Use the useDossier hook for data management
  const { wikiData, isLoading, handleRefresh, hasAccess } = useDossier({
    countryName,
    countryData,
  });

  // Handle wiki link clicks
  const handleWikiLinkClick = useCallback(
    (pageName: string) => {
      const source = wikiData.wikiSource ?? "ixwiki";
      if (source === "ixwiki") {
        router.push(titleToWikiOSRoute(pageName));
      } else {
        let baseUrl = "https://iiwiki.com/wiki/";
        if (source === "althistory") {
          baseUrl = "https://althistory.fandom.com/wiki/";
        }
        const wikiUrl = `${baseUrl}${encodeURIComponent(pageName)}`;
        window.open(wikiUrl, "_blank", "noopener,noreferrer");
      }
    },
    [wikiData.wikiSource, router]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="rounded-card">
          <CardContent className="p-8">
            <div className="space-y-4">
              <Skeleton className="rounded-control h-12 w-12" />
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (wikiData.error) {
    return (
      <Card className="rounded-card">
        <CardContent className="p-8 text-center">
          <AlertTriangle className="text-destructive mx-auto mb-3 h-6 w-6" />
          <h3 className="text-label text-title-3 mb-2">Wiki intelligence unavailable</h3>
          <p className="text-label-secondary mb-4">{wikiData.error}</p>
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Get flag image URL for header background
  const flagImageUrl =
    wikiData.infobox?.image_flag || wikiData.infobox?.flag
      ? resolveImageUrl(wikiData.infobox.image_flag || wikiData.infobox.flag, wikiData.wikiSource)
      : undefined;

  const activeSections = wikiData.sections.filter(
    (section) => hasAccess(section.classification) && section.id !== "overview"
  );

  const tocSections: TocItem[] = activeSections.map((s) => ({
    id: s.id,
    title: s.title,
    source: "wiki",
    pageTitle: s.sourcePage,
    classification: s.classification,
  }));

  const nativeTocItems: TocItem[] = nativeDocs.map((d) => ({
    id: d.id,
    title: d.title,
    source: "native",
    classification: d.clearance,
  }));

  const handleSelectTocSection = (sectionId: string) => {
    setActiveSectionId(sectionId);
    setOpenSections((prev) => ({ ...prev, [sectionId]: true }));
    const el = document.getElementById(`dossier-section-${sectionId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <WikiHeader
          countryName={countryName}
          activeView={activeView}
          setActiveView={setActiveView}
          viewerClearanceLevel={viewerClearanceLevel}
          flagImageUrl={flagImageUrl}
        />

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {/* Sections View (Wiki Synced Dossier) */}
            {activeView === "sections" && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                {/* Main Content Area */}
                <div className="space-y-6 lg:col-span-8">
                  {/* Empty state: No sections returned from wiki */}
                  {wikiData.sections.length === 0 && (
                    <Card className="rounded-card">
                      <CardContent className="p-8 text-center">
                        <BookOpen className="text-label-secondary mx-auto mb-3 h-6 w-6" />
                        <h3 className="text-label text-title-3 mb-2">No wiki sections found</h3>
                        <p className="text-label-secondary text-body mx-auto mb-6 max-w-md">
                          There is no active WikiOS database entry for{" "}
                          <strong>{countryName}</strong>.
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-3">
                          <Button asChild>
                            <Link href={pageEditHref(countryName)}>Create page on WikiOS</Link>
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() =>
                              openCanvas({
                                title: `${countryName} National Briefing`,
                                content: `Executive briefing and lore summary for ${countryName}.`,
                                clearance: "PUBLIC",
                              })
                            }
                          >
                            Create native lore document
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Section Cards */}
                  {activeSections.map((section, idx) => (
                    <div key={section.id} id={`dossier-section-${section.id}`}>
                      <WikiSectionCard
                        section={section}
                        isOpen={openSections[section.id] ?? idx === 0}
                        onToggle={() => toggleSection(section.id)}
                        onShowFullContent={(sec) => setModalSection(sec)}
                        handleWikiLinkClick={handleWikiLinkClick}
                        flagColors={flagColors}
                        countryName={countryName}
                        wikiSource={wikiData.wikiSource}
                      />
                    </div>
                  ))}
                </div>

                {/* Right Sticky TOC Sidebar */}
                <div className="lg:col-span-4">
                  <div className="sticky top-(--shell-top-offset)">
                    <DossierTocSidebar
                      countryName={countryName}
                      infobox={wikiData.infobox}
                      sections={tocSections}
                      nativeDocs={nativeTocItems}
                      activeSectionId={activeSectionId}
                      onSelectSection={handleSelectTocSection}
                      flagColors={flagColors}
                      wikiSource={wikiData.wikiSource}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeView === "native_lore" && (
              <NativeLoreView
                docs={nativeDocs}
                onNew={() => openCanvas(null)}
                onEdit={openCanvas}
                onDelete={deleteDoc}
                onImport={importSections}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Canvas Editor Modal */}
        {isCanvasModalOpen && (
          <NativeLoreCanvasModal
            isOpen={isCanvasModalOpen}
            onClose={() => {
              setIsCanvasModalOpen(false);
              setEditingLoreDoc(null);
            }}
            onSave={(draft) => {
              saveDoc(draft, editingLoreDoc?.id);
              setEditingLoreDoc(null);
            }}
            initialTitle={editingLoreDoc?.title}
            initialContent={editingLoreDoc?.content}
            initialClearance={editingLoreDoc?.clearance}
          />
        )}
      </div>

      {/* Full Content Modal */}
      <WikiContentModal
        isOpen={!!modalSection}
        onClose={() => setModalSection(null)}
        section={modalSection}
        handleWikiLinkClick={handleWikiLinkClick}
        flagColors={flagColors}
      />
    </>
  );
};
