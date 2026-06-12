// src/components/MediaSearchModal.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Loader2, Download } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useNotify } from "~/hooks/useNotify";
import { processImageSelection, isExternalImageUrl } from "~/lib/image-download-service";
import { cn } from "~/lib/utils";

// Modular tab components
import type { CommonsImage } from "./media-search/types";
import { WebPhotosTab } from "./media-search/WebPhotosTab";
import { WikiRepositoryTab } from "./media-search/WikiRepositoryTab";
import { UploadTab } from "./media-search/UploadTab";

// Import WikiOS styles for component support
import "~/styles/wiki-os/variables.css";
import "~/styles/wiki-os/components.css";

interface MediaSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImageSelect: (imageUrl: string) => void;
  onFileUpload?: (file: File) => Promise<void>;
}

type MainTab = "web-photos" | "wiki-repository" | "stash" | "upload";

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
          "glass-hierarchy-modal flex max-h-[92vh] flex-col overflow-hidden p-0 transition-all duration-300 ease-in-out",
          isCategoryExpanded ? "max-w-7xl" : "max-w-5xl"
        )}
        data-dialog-nested="true"
      >
        <DialogHeader className="border-border/40 shrink-0 border-b px-6 pt-5 pb-3">
          <DialogTitle className="text-foreground text-base font-bold">
            Search Image Library
          </DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as MainTab)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="border-border/40 grid w-full grid-cols-2 rounded-none border-b bg-transparent p-0">
            <TabsTrigger
              value="wiki-repository"
              className="data-[state=active]:text-foreground rounded-none py-2.5 text-xs data-[state=active]:bg-black/5 data-[state=active]:shadow-none dark:data-[state=active]:bg-white/5"
            >
              Repository
            </TabsTrigger>
            <TabsTrigger
              value="upload"
              className="data-[state=active]:text-foreground rounded-none py-2.5 text-xs data-[state=active]:bg-black/5 data-[state=active]:shadow-none dark:data-[state=active]:bg-white/5"
            >
              Upload
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Web Photos (Unsplash) */}
          <TabsContent
            value="web-photos"
            className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
          >
            <WebPhotosTab
              selectedImage={selectedImage}
              onSelectImage={setSelectedImage}
              onDoubleClickConfirm={handleSelectConfirm}
            />
          </TabsContent>

          {/* Tab 2: Wiki Repository */}
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

          {/* Tab 4: Upload */}
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
          <div className="border-border/40 bg-card/10 flex shrink-0 items-center justify-end gap-3 border-t px-6 py-4">
            {isDownloading && (
              <div className="flex items-center gap-2 text-xs text-blue-400">
                <Download className="h-3.5 w-3.5 animate-bounce" />
                <span>Downloading file to local cache...</span>
              </div>
            )}
            <Button
              onClick={handleSelectConfirm}
              disabled={!selectedImage || isDownloading}
              size="sm"
              className="h-8 px-4 text-xs font-semibold"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
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
