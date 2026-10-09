"use client";

import React, { useState, useEffect, useRef } from "react";
import { SystemRestart as Loader2, Download } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useNotify } from "~/hooks/useNotify";
import { processImageSelection, isExternalImageUrl } from "~/lib/media";
import { cn } from "~/lib/utils";

import type { CommonsImage } from "./types";
import { WikiRepositoryTab } from "./WikiRepositoryTab";
import { UploadTab } from "./UploadTab";

interface MediaSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImageSelect: (imageUrl: string) => void;
}

type MainTab = "wiki-repository" | "upload";

export function MediaSearchModal({ isOpen, onClose, onImageSelect }: MediaSearchModalProps) {
  const notify = useNotify();

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<MainTab>("wiki-repository");

  // Selection states
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageObj, setSelectedImageObj] = useState<CommonsImage | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCategoryExpanded, setIsCategoryExpanded] = useState(false);
  // The in-flight "use this image" request; set while one runs, aborted when the picker closes.
  const confirmRef = useRef<AbortController | null>(null);

  const cancelConfirm = () => {
    confirmRef.current?.abort();
    confirmRef.current = null;
  };

  useEffect(() => cancelConfirm, []);

  // Reset selections when modal opens or active tab changes
  useEffect(() => {
    if (isOpen) {
      // oxlint-disable-next-line
      setSelectedImage(null);
      setSelectedImageObj(null);
      setActiveTab("wiki-repository");
    } else {
      cancelConfirm();
    }
    if (!isOpen || activeTab !== "wiki-repository") {
      setIsCategoryExpanded(false);
    }
  }, [isOpen, activeTab]);

  const handleWikiSelectImage = (img: CommonsImage | null) => {
    if (!img) {
      setSelectedImage(null);
      setSelectedImageObj(null);
    } else {
      setSelectedImageObj(img);
      setSelectedImage(img.url);
    }
  };

  const handleSelectConfirm = async () => {
    if (confirmRef.current) return;
    if (!selectedImage) {
      notify.error("Please select an image first.");
      return;
    }

    const controller = new AbortController();
    confirmRef.current = controller;
    try {
      if (isExternalImageUrl(selectedImage)) {
        setIsDownloading(true);
        notify.info("Downloading image...");

        const processedUrl = await processImageSelection(selectedImage, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;

        notify.success("Image downloaded and ready to use");
        onImageSelect(processedUrl);
      } else {
        onImageSelect(selectedImage);
      }
      onClose();
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error("[MediaSearchModal] Download failed:", error);
      notify.error("Failed to download image. Try a different source.");
    } finally {
      if (confirmRef.current === controller) confirmRef.current = null;
      setIsDownloading(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (open) return;
        cancelConfirm();
        onClose();
      }}
    >
      <DialogContent
        className={cn(
          "flex h-[88vh] max-h-[92vh] flex-col overflow-hidden p-0 transition-[max-width] duration-300 ease-in-out",
          isCategoryExpanded ? "max-w-7xl" : "max-w-5xl"
        )}
        data-dialog-nested="true"
        onEscapeKeyDown={(e) => {
          // Escape first closes the detail panel, then the picker.
          if (selectedImageObj) {
            e.preventDefault();
            handleWikiSelectImage(null);
          }
        }}
      >
        <DialogHeader className="border-separator shrink-0 border-b px-6 pt-5 pb-3">
          <DialogTitle className="text-label text-title-3">Search repository</DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as MainTab)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="border-separator grid w-full grid-cols-2 rounded-none border-b bg-transparent p-0">
            <TabsTrigger
              value="wiki-repository"
              className="data-[state=active]:text-label text-footnote data-[state=active]:bg-fill-3 cursor-pointer rounded-none py-3 transition-[color,background-color,border-color,box-shadow,opacity,transform] select-none data-[state=active]:shadow-none"
            >
              Repository
            </TabsTrigger>
            <TabsTrigger
              value="upload"
              className="data-[state=active]:text-label text-footnote data-[state=active]:bg-fill-3 cursor-pointer rounded-none py-3 transition-[color,background-color,border-color,box-shadow,opacity,transform] select-none data-[state=active]:shadow-none"
            >
              Upload
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Wiki Repository (Commons, IxWiki, IIWiki, My Stash) */}
          <TabsContent
            value="wiki-repository"
            className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
          >
            <WikiRepositoryTab
              selectedImageObj={selectedImageObj}
              onSelectImage={handleWikiSelectImage}
              onDoubleClickConfirm={handleSelectConfirm}
              isCategoryExpanded={isCategoryExpanded}
              setIsCategoryExpanded={setIsCategoryExpanded}
            />
          </TabsContent>

          {/* Tab 2: Upload */}
          <TabsContent
            value="upload"
            className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
          >
            <UploadTab
              onImageSelect={onImageSelect}
              onClose={onClose}
              isUploading={isUploading}
              setIsUploading={setIsUploading}
            />
          </TabsContent>
        </Tabs>

        {/* Modal Bottom Action Controls */}
        {activeTab !== "upload" && (
          <div className="border-separator bg-surface flex shrink-0 items-center justify-end gap-3 border-t px-6 py-4">
            {isDownloading && (
              <div className="text-footnote text-tint flex items-center gap-2">
                <Download className="size-3.5" aria-hidden="true" />
                <span>Downloading file to local cache...</span>
              </div>
            )}
            <Button
              onClick={handleSelectConfirm}
              disabled={!selectedImage || isDownloading}
              size="sm"
              className="text-caption h-8 cursor-pointer px-4 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform]"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Downloading...
                </>
              ) : (
                "Select Image"
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
