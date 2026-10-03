"use client";

import { Badge } from "~/components/ui/badge";
import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { titleToWikiOSPath } from "~/lib/wiki-os/transformers/url-compat";
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
  Plus,
  Upload,
  Trash as Trash2,
  EditPencil as Edit3,
} from "iconoir-react";
import { resolveImageUrl } from "~/lib/wiki-os/adapters/ixstates/unified-parser";
import Link from "next/link";
import { NativeLoreCanvasModal } from "./dossier/NativeLoreCanvasModal";
import { FileImportDropzone, type ParsedLoreSection } from "./dossier/FileImportDropzone";
import { Card, CardContent } from "~/components/ui/card";

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

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // State for Canvas editor and file import
  const [isCanvasModalOpen, setIsCanvasModalOpen] = useState(false);
  const [showFileImport, setShowFileImport] = useState(false);
  const [editingLoreDoc, setEditingLoreDoc] = useState<{
    id?: string;
    title: string;
    content: string;
    clearance: "PUBLIC" | "ALLIANCE" | "PRIVATE";
  } | null>(null);

  // Native lore documents (persisted locally per nation as fallback + ready for DB sync)
  const [nativeDocs, setNativeDocs] = useState<
    Array<{
      id: string;
      title: string;
      content: string;
      clearance: "PUBLIC" | "ALLIANCE" | "PRIVATE";
      updatedAt: string;
    }>
  >(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(`ixstats_native_lore_${countryName}`);
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const saveNativeDocs = (
    docs: Array<{
      id: string;
      title: string;
      content: string;
      clearance: "PUBLIC" | "ALLIANCE" | "PRIVATE";
      updatedAt: string;
    }>
  ) => {
    setNativeDocs(docs);
    if (typeof window !== "undefined") {
      localStorage.setItem(`ixstats_native_lore_${countryName}`, JSON.stringify(docs));
    }
  };

  const handleSaveNativeDoc = (doc: {
    title: string;
    content: string;
    clearance: "PUBLIC" | "ALLIANCE" | "PRIVATE";
  }) => {
    if (editingLoreDoc?.id) {
      const updated = nativeDocs.map((d) =>
        d.id === editingLoreDoc.id ? { ...d, ...doc, updatedAt: new Date().toISOString() } : d
      );
      saveNativeDocs(updated);
    } else {
      const newDoc = {
        id: `lore_${Date.now()}`,
        ...doc,
        updatedAt: new Date().toISOString(),
      };
      saveNativeDocs([newDoc, ...nativeDocs]);
    }
    setEditingLoreDoc(null);
  };

  const handleImportSections = (sections: ParsedLoreSection[]) => {
    const imported = sections.map((s, idx) => ({
      id: `lore_imported_${Date.now()}_${idx}`,
      title: s.title,
      content: s.content,
      clearance: s.classification,
      updatedAt: new Date().toISOString(),
    }));
    saveNativeDocs([...imported, ...nativeDocs]);
    setShowFileImport(false);
  };

  const handleDeleteNativeDoc = (id: string) => {
    saveNativeDocs(nativeDocs.filter((d) => d.id !== id));
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
        router.push(titleToWikiOSPath(pageName));
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
          <h3 className="text-label text-title-3 mb-2">Wiki Intelligence Unavailable</h3>
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
                        <h3 className="text-label text-title-3 mb-2">No Wiki Sections Found</h3>
                        <p className="text-label-secondary text-body mx-auto mb-6 max-w-md">
                          There is no active WikiOS database entry for{" "}
                          <strong>{countryName}</strong>.
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-3">
                          <Button asChild>
                            <Link
                              href={`/wiki/${encodeURIComponent(countryName.replace(/ /g, "_"))}/edit`}
                            >
                              Create Page on WikiOS
                            </Link>
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setEditingLoreDoc({
                                title: `${countryName} National Briefing`,
                                content: `Executive briefing and lore summary for ${countryName}.`,
                                clearance: "PUBLIC",
                              });
                              setIsCanvasModalOpen(true);
                            }}
                          >
                            Create Native Lore Document
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

            {/* Native Lore View */}
            {activeView === "native_lore" && (
              <div className="space-y-6">
                {/* Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-label text-headline">Native Lore Documents</h3>
                    <p className="text-label-secondary text-footnote">
                      Custom dossier documents created via the WikiOS Canvas Editor or file import.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFileImport(!showFileImport)}
                      className="text-caption gap-2 font-semibold"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {showFileImport ? "Hide Import" : "Import Files"}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setEditingLoreDoc(null);
                        setIsCanvasModalOpen(true);
                      }}
                      className="text-footnote gap-2"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      New Document
                    </Button>
                  </div>
                </div>

                {/* File Import Dropzone Area */}
                {showFileImport && (
                  <FileImportDropzone
                    onImportSections={handleImportSections}
                    onCancel={() => setShowFileImport(false)}
                  />
                )}

                {/* Document Grid / Empty State */}
                {nativeDocs.length === 0 ? (
                  <Card className="rounded-card">
                    <CardContent className="p-8 text-center">
                      <BookOpen className="text-label-secondary mx-auto mb-3 h-6 w-6" />
                      <h3 className="text-label text-title-3 mb-2">No Native Lore Documents</h3>
                      <p className="text-label-secondary text-body mx-auto mb-6 max-w-md">
                        Create custom dossier documents directly using the WikiOS Canvas Editor or
                        import existing markdown/text files.
                      </p>
                      <Button
                        onClick={() => {
                          setEditingLoreDoc(null);
                          setIsCanvasModalOpen(true);
                        }}
                      >
                        Create First Document
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {nativeDocs.map((doc) => (
                      <Card key={doc.id} className="rounded-card p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-label text-headline truncate">{doc.title}</h4>
                              <Badge variant="outline" className="capitalize">
                                {doc.clearance.toLowerCase()}
                              </Badge>
                            </div>
                            <p className="text-label-secondary text-footnote mt-1 line-clamp-3">
                              {doc.content.replace(/<[^>]*>/g, "").slice(0, 150)}...
                            </p>
                          </div>
                        </div>

                        <div className="border-separator mt-4 flex items-center justify-between border-t pt-3">
                          <span className="text-label-secondary text-footnote">
                            Updated {new Date(doc.updatedAt).toLocaleDateString()}
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setEditingLoreDoc(doc);
                                setIsCanvasModalOpen(true);
                              }}
                              title="Edit Document"
                              aria-label={`Edit ${doc.title}`}
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="hover:text-destructive h-8 w-8"
                              onClick={() => handleDeleteNativeDoc(doc.id)}
                              title="Delete Document"
                              aria-label={`Delete ${doc.title}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
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
            onSave={handleSaveNativeDoc}
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

export default DossierTab;
