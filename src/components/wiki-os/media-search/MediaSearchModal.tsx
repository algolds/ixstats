"use client";
// src/components/MediaSearchModal.tsx

import React, { useState, useEffect } from "react";
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
  onFileUpload?: (file: File) => Promise<void>;
}

type MainTab = "wiki-repository" | "upload";

export function MediaSearchModal({
  isOpen,
  onClose,
  onImageSelect,
  onFileUpload,
}: MediaSearchModalProps) {
  const notify = useNotify();

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<MainTab>("wiki-repository");

  // Selection states
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageObj, setSelectedImageObj] = useState<CommonsImage | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCategoryExpanded, setIsCategoryExpanded] = useState(false);

  // Reset selections when modal opens or active tab changes
  useEffect(() => {
    if (isOpen) {
      // oxlint-disable-next-line
      setSelectedImage(null);
      setSelectedImageObj(null);
    }
    if (!isOpen || activeTab !== "wiki-repository") {
      setIsCategoryExpanded(false);
    }
  }, [isOpen, activeTab]);

  const handleWikiSelectImage = (img: CommonsImage) => {
    if (!img) {
      setSelectedImage(null);
      setSelectedImageObj(null);
    } else {
      setSelectedImageObj(img);
      setSelectedImage(img.url);
    }
  };

  const handleSelectConfirm = async () => {
    if (!selectedImage) {
      notify.error("Please select an image first.");
      return;
    }

    try {
      if (isExternalImageUrl(selectedImage)) {
        setIsDownloading(true);
        notify.info("Downloading image...");

        const processedUrl = await processImageSelection(selectedImage, {
          onProgress: (message) => console.log("[MediaSearchModal]", message),
          onError: (error) => console.error("[MediaSearchModal]", error),
        });

        notify.success("Image downloaded and ready to use!");
        onImageSelect(processedUrl);
      } else {
        onImageSelect(selectedImage);
      }
      onClose();
    } catch (error) {
      console.error("[MediaSearchModal] Download failed:", error);
      notify.error("Failed to download image. Try a different source.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          "flex h-[88vh] max-h-[92vh] flex-col overflow-hidden p-0 transition-[max-width] duration-300 ease-in-out",
          isCategoryExpanded ? "max-w-7xl" : "max-w-5xl"
        )}
        data-dialog-nested="true"
      >
        <DialogHeader className="border-separator shrink-0 border-b px-6 pt-5 pb-3">
          <DialogTitle className="text-label text-title-3">Search Repository</DialogTitle>
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
              onFileUpload={onFileUpload}
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
              className="text-caption h-8 cursor-pointer px-4 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98]"
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
