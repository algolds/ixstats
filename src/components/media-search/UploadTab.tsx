// src/components/media-search/UploadTab.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { cn } from "~/lib/utils";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useNotify } from "~/hooks/useNotify";
import { withBasePath } from "~/lib/base-path";

interface UploadTabProps {
  onImageSelect: (imageUrl: string) => void;
  onClose: () => void;
  onFileUpload?: (file: File) => Promise<void>;
  isUploading: boolean;
  setIsUploading: (val: boolean) => void;
}

export function UploadTab({
  onImageSelect,
  onClose,
  onFileUpload,
  isUploading,
  setIsUploading,
}: UploadTabProps) {
  const notify = useNotify();
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processUploadFile = useCallback(
    async (file: File) => {
      if (file.size > 5 * 1024 * 1024) {
        notify.error("File size exceeds 5MB limit");
        return;
      }

      const allowedTypes = [
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/gif",
        "image/webp",
        "image/svg+xml",
      ];
      if (!allowedTypes.includes(file.type)) {
        notify.error("Invalid file type. Please upload PNG, JPG, GIF, WEBP, or SVG");
        return;
      }

      setIsUploading(true);
      try {
        if (onFileUpload) {
          await onFileUpload(file);
        } else {
          const formData = new FormData();
          formData.append("file", file);

          const response = await fetch(withBasePath("/api/upload/image"), {
            method: "POST",
            body: formData,
          });

          const result = await response.json();

          if (result.success) {
            onImageSelect(result.url);
            onClose();
            notify.success("Image uploaded successfully");
          } else if (response.status === 401) {
            notify.error(
              "Authentication required",
              "You need to be signed in to upload images."
            );
          } else if (response.status === 429) {
            notify.error(
              "Upload limit reached",
              result.retryAfter ? `Please try again in ${result.retryAfter} seconds.` : "Please try again later."
            );
          } else {
            notify.error(result.error || "Failed to upload image");
          }
        }
      } catch (error) {
        console.error("Upload error:", error);
        notify.error("Upload failed", "Could not connect to the server.");
      } finally {
        setIsUploading(false);
      }
    },
    [notify, onFileUpload, onImageSelect, onClose, setIsUploading]
  );

  // Clipboard paste handler
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (isUploading) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf("image") !== -1) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            void processUploadFile(file);
            break; // process first image pasted
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [isUploading, processUploadFile]);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processUploadFile(file);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-6 overflow-y-auto">
      <div className="mx-auto w-full max-w-lg mt-6">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById("drag-upload-input")?.click()}
          className={cn(
            "rounded-xl border-2 border-dashed p-10 text-center transition-all cursor-pointer backdrop-blur-md bg-slate-100/50 dark:bg-white/5 flex flex-col items-center justify-center min-h-[200px]",
            isDragging
              ? "border-blue-500 bg-blue-500/5 shadow-[0_0_15px_rgba(59,130,246,0.2)]"
              : "border-border/40 hover:border-blue-400/50 hover:bg-slate-200/50 dark:hover:bg-white/10"
          )}
        >
          <Upload className={cn("mb-4 h-10 w-10 transition-colors", isDragging ? "text-blue-400" : "text-muted-foreground")} />
          <h3 className="mb-1 text-sm font-semibold text-foreground">
            {isDragging ? "Drop your file here" : "Drag, drop or paste your image"}
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            or click to browse local files
          </p>
          <input
            type="file"
            id="drag-upload-input"
            accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/svg+xml"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                await processUploadFile(file);
              }
              e.target.value = "";
            }}
          />
          <Button
            onClick={(e) => {
              e.stopPropagation();
              document.getElementById("drag-upload-input")?.click();
            }}
            disabled={isUploading}
            size="sm"
            className="h-8 text-xs font-semibold"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Uploading...
              </>
            ) : (
              "Select File"
            )}
          </Button>
        </div>
      </div>

      {/* Requirements low-contrast subtle footer */}
      <div className="border-t border-border/5 pt-4 mt-6 text-[10px] text-muted-foreground flex justify-between">
        <span>Maximum size: 5MB</span>
        <span>Formats: PNG, JPG, GIF, WEBP, SVG</span>
        <span>Directly embeds in your content</span>
      </div>
    </div>
  );
}
