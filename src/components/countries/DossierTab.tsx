"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { titleToWikiOSPath } from "~/lib/wiki-os/url-compat";
import { motion, AnimatePresence } from "motion/react";
import type { DossierTabProps } from "~/types/dossier";
import { useDossier } from "~/hooks/useDossier";
import { WikiHeader } from "./dossier/WikiHeader";
import { WikiSectionCard } from "./dossier/WikiSectionCard";
import { DossierTocSidebar } from "./dossier/DossierTocSidebar";
import WikiContentModal from "./dossier/WikiContentModal";
import { Skeleton } from "~/components/ui/skeleton";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { RiAlertLine, RiRefreshLine } from "react-icons/ri";
import { resolveImageUrl } from "~/lib/unified-wiki-parser";
import Link from "next/link";
import { BookOpen, Plus, Upload, Trash2, Edit3, Lock, Shield, Eye } from "lucide-react";
import { NativeLoreCanvasModal } from "./dossier/NativeLoreCanvasModal";
import { FileImportDropzone } from "./dossier/FileImportDropzone";
import { LoreScannerPreferencesModal } from "./dossier/LoreScannerPreferencesModal";

/**
 * DossierTab Component
 *
 * Displays national dossier data for a country with multiple views:
 * - Sections (Wiki Synced Dossier): Main wiki content organized by topic
 * - Native Lore: Custom canvas documents & file imports
 * - Conflicts (Data Analysis): Data discrepancies between wiki and IxStats
 * - Settings: Configuration for dossier data discovery
 */
export const DossierTab: React.FC<DossierTabProps> = ({
  countryName,
  countryData,
  viewerClearanceLevel = "PUBLIC",
  flagColors = { primary: "#3b82f6", secondary: "#6366f1", accent: "#8b5cf6" },
}) => {
  const router = useRouter();

  // State for active view
  const [activeView, setActiveView] = useState<"sections" | "native_lore" | "settings">("sections");

  // State for Canvas editor, file import & settings modals
  const [isCanvasModalOpen, setIsCanvasModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
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
        d.id === editingLoreDoc.id
          ? { ...d, ...doc, updatedAt: new Date().toISOString() }
          : d
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

  const handleImportSections = (sections: Array<{ title: string; content: string; classification: "PUBLIC" | "ALLIANCE" | "PRIVATE" }>) => {
    const imported = sections.map((s, idx) => ({
      id: `imported_${Date.now()}_${idx}`,
      title: s.title,
      content: s.content,
      clearance: s.classification,
      updatedAt: new Date().toISOString(),
    }));
    saveNativeDocs([...imported, ...nativeDocs]);
    setShowFileImport(false);
    setActiveView("native_lore");
  };

  // State for modal
  const [modalSection, setModalSection] = useState<{
    title: string;
    content: string;
    id: string;
  } | null>(null);

  // Use custom hook for data management
  const {
    wikiData,
    dataConflicts,
    wikiSettings,
    setWikiSettings,
    openSections,
    toggleSection,
    handleRefresh,
    isLoading,
    isRefreshing,
    hasAccess,
  } = useDossier({
    countryName,
    countryData,
  });

  // Handle wiki link clicks
  const handleWikiLinkClick = useCallback(
    (pageName: string) => {
      console.log(`[WikiIntelligence] Wiki link clicked: ${pageName}`);
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

  // Handle settings apply
  const handleApplySettings = useCallback(async () => {
    console.log("[WikiIntelligence] Applying advanced settings:", wikiSettings);
    console.log("[WikiIntelligence] Custom pages:", wikiSettings.customPages);
    await handleRefresh();
  }, [wikiSettings, handleRefresh]);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="glass-hierarchy-child">
          <CardContent className="p-8">
            <div className="space-y-4">
              <Skeleton className="h-12 w-12 rounded-lg" />
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
      <Card className="glass-hierarchy-child">
        <CardContent className="p-8 text-center">
          <RiAlertLine className="mx-auto mb-4 h-12 w-12 text-red-600 dark:text-red-400" />
          <h3 className="mb-2 text-lg font-semibold">Wiki Intelligence Unavailable</h3>
          <p className="text-muted-foreground mb-4">{wikiData.error}</p>
          <Button onClick={handleRefresh} variant="outline">
            <RiRefreshLine className="mr-2 h-4 w-4" />
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

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <WikiHeader
          countryName={countryName}
          activeView={activeView}
          setActiveView={setActiveView}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          viewerClearanceLevel={viewerClearanceLevel}
          flagImageUrl={flagImageUrl}
        />

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {/* Sections View (Dossier) */}
            {activeView === "sections" && (
              activeSections.length > 0 || wikiData.infobox ? (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
                  {/* Main Content - Dossier Sections */}
                  <div className="space-y-4 xl:col-span-3">
                    {activeSections.map((section) => (
                      <WikiSectionCard
                        key={section.id}
                        section={section}
                        isOpen={openSections[section.id] ?? true}
                        onToggle={() => toggleSection(section.id)}
                        onShowFullContent={setModalSection}
                        handleWikiLinkClick={handleWikiLinkClick}
                        flagColors={flagColors}
                        countryName={countryName}
                        wikiSource={wikiData.wikiSource}
                      />
                    ))}
                  </div>

                  {/* Right Sidebar - Dossier Table of Contents & Infobox */}
                  <div className="xl:col-span-1">
                    <DossierTocSidebar
                      countryName={countryName}
                      infobox={wikiData.infobox}
                      sections={activeSections.map((s) => ({
                        id: s.id,
                        title: s.title,
                        source: "wiki",
                        classification: s.classification,
                      }))}
                      nativeDocs={nativeDocs.map((d) => ({
                        id: d.id,
                        title: d.title,
                        source: "native",
                        classification: d.clearance,
                      }))}
                      onSelectSection={(id) => {
                        const el = document.getElementById(id);
                        if (el) {
                          el.scrollIntoView({ behavior: "smooth" });
                        }
                      }}
                      flagColors={flagColors}
                      wikiSource={wikiData.wikiSource}
                    />
                  </div>
                </div>
              ) : (
                <Card className="glass-surface border-border overflow-hidden">
                  <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                    <div className="bg-muted/50 mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                      <BookOpen className="text-muted-foreground/60 h-8 w-8" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-foreground">Dossier Pending</h3>
                    <p className="text-muted-foreground mb-6 max-w-md text-xs leading-relaxed">
                      There is no active WikiOS database entry for <strong>{countryName}</strong>.
                      Under standard diplomatic protocols, a public dossier is generated once a wiki article is initialized.
                    </p>
                    <Button asChild variant="outline" className="border-blue-500/30 text-blue-500 hover:bg-blue-500/10">
                      <Link href={`/wiki/${encodeURIComponent(countryName.replace(/ /g, "_"))}`}>
                        Create Page on WikiOS
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              )
            )}

            {/* Native Canvas Lore View */}
            {activeView === "native_lore" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-foreground">
                      Native Canvas Lore Hub
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Direct non-wiki documents created via WikiOS Canvas Editor or file import
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowFileImport(!showFileImport)}
                      className="border-white/10 text-xs font-bold gap-1.5"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Import File (.md)
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setEditingLoreDoc(null);
                        setIsCanvasModalOpen(true);
                      }}
                      className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold gap-1.5 shadow-md"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      New Canvas Document
                    </Button>
                  </div>
                </div>

                {showFileImport && (
                  <FileImportDropzone
                    onImportSections={handleImportSections}
                    onCancel={() => setShowFileImport(false)}
                  />
                )}

                {nativeDocs.length === 0 ? (
                  <Card className="glass-surface border-white/10 overflow-hidden">
                    <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                      <div className="bg-blue-500/10 mb-4 flex h-16 w-16 items-center justify-center rounded-full text-blue-400">
                        <BookOpen className="h-8 w-8" />
                      </div>
                      <h3 className="mb-2 text-lg font-semibold text-foreground">No Native Lore Documents</h3>
                      <p className="text-muted-foreground mb-6 max-w-md text-xs leading-relaxed">
                        Create custom dossier documents directly using the WikiOS Canvas Editor or import Markdown files to store non-wiki lore for <strong>{countryName}</strong>.
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            setEditingLoreDoc(null);
                            setIsCanvasModalOpen(true);
                          }}
                          className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold gap-1.5"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Create First Canvas Document
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {nativeDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className="group relative flex flex-col justify-between rounded-xl border border-white/10 bg-card/30 p-4 backdrop-blur-md transition-all hover:border-white/20 hover:bg-white/[0.05]"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span
                              className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded ${
                                doc.clearance === "PUBLIC"
                                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                  : doc.clearance === "ALLIANCE"
                                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                  : "bg-red-500/20 text-red-400 border border-red-500/30"
                              }`}
                            >
                              {doc.clearance}
                            </span>

                            <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingLoreDoc(doc);
                                  setIsCanvasModalOpen(true);
                                }}
                                className="h-7 w-7 p-0"
                              >
                                <Edit3 className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  saveNativeDocs(nativeDocs.filter((d) => d.id !== doc.id));
                                }}
                                className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>

                          <h4 className="text-sm font-bold text-foreground mb-1 group-hover:text-blue-400 transition-colors">
                            {doc.title}
                          </h4>
                          <p className="line-clamp-3 text-xs text-muted-foreground leading-relaxed">
                            {doc.content.replace(/<[^>]*>?/gm, "").slice(0, 200)}...
                          </p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>Updated {new Date(doc.updatedAt).toLocaleDateString()}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setModalSection({
                                id: doc.id,
                                title: doc.title,
                                content: doc.content,
                              });
                            }}
                            className="h-6 text-[10px] font-semibold text-blue-400 hover:text-blue-300"
                          >
                            Read Full Document →
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Settings View */}
            {activeView === "settings" && (
              <WikiSettingsView
                wikiSettings={wikiSettings}
                setWikiSettings={setWikiSettings}
                countryName={countryName}
                onApplySettings={handleApplySettings}
                isApplying={isRefreshing}
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
            onSave={handleSaveNativeDoc}
            initialTitle={editingLoreDoc?.title}
            initialContent={editingLoreDoc?.content}
            initialClearance={editingLoreDoc?.clearance}
          />
        )}

        {/* LoreScanner Preferences Modal */}
        {isSettingsModalOpen && (
          <LoreScannerPreferencesModal
            isOpen={isSettingsModalOpen}
            onClose={() => setIsSettingsModalOpen(false)}
            wikiSettings={wikiSettings}
            setWikiSettings={setWikiSettings}
            countryName={countryName}
            onApplySettings={handleApplySettings}
            isApplying={isRefreshing}
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
        enableIxWiki={wikiSettings.enableIxWiki}
      />
    </>
  );
};

export default DossierTab;
