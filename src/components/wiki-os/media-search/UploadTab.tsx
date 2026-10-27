"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "~/lib/utils";
import { Upload, SystemRestart as Loader2 } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { useNotify } from "~/hooks/useNotify";
import { uploadImageFile, UploadImageError } from "~/lib/media/upload-image";

interface UploadTabProps {
  onImageSelect: (imageUrl: string) => void;
  onClose: () => void;
  isUploading: boolean;
  setIsUploading: (val: boolean) => void;
}

export function UploadTab({ onImageSelect, onClose, isUploading, setIsUploading }: UploadTabProps) {
  const notify = useNotify();
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    []
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Moving over a child of the drop zone also fires dragleave on the zone; that is not leaving it.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setIsDragging(false);
  };

  const processUploadFile = useCallback(
    async (file: File) => {
      if (uploadingRef.current) return;
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

      uploadingRef.current = true;
      const controller = new AbortController();
      abortRef.current = controller;
      setIsUploading(true);
      try {
        const url = await uploadImageFile(file, { signal: controller.signal });
        if (controller.signal.aborted) return;
        onImageSelect(url);
        onClose();
        notify.success("Image uploaded");
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof UploadImageError && error.status === 401) {
          notify.error("Authentication required", "You need to be signed in to upload images.");
        } else if (error instanceof UploadImageError && error.status === 429) {
          notify.error(
            "Upload limit reached",
            error.retryAfter
              ? `Please try again in ${error.retryAfter} seconds.`
              : "Please try again later."
          );
        } else if (error instanceof UploadImageError) {
          notify.error(error.message || "Failed to upload image");
        } else {
          console.error("Upload error:", error);
          notify.error("Upload failed", "Could not connect to the server.");
        }
      } finally {
        uploadingRef.current = false;
        setIsUploading(false);
      }
    },
    [notify, onImageSelect, onClose, setIsUploading]
  );

  // Clipboard paste handler
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (uploadingRef.current) return;
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
  }, [processUploadFile]);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processUploadFile(file);
    }
  };

  return (
    <div className="flex flex-1 flex-col justify-between overflow-y-auto p-6">
      <div className="mx-auto mt-6 w-full max-w-lg">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => {
            if (!isUploading) inputRef.current?.click();
          }}
          aria-disabled={isUploading}
          className={cn(
            "rounded-row bg-fill-2 flex min-h-[200px] cursor-pointer flex-col items-center justify-center border-2 border-dashed p-10 text-center transition-[color,background-color,border-color,box-shadow,opacity,transform]",
            isUploading && "pointer-events-none opacity-60",
            isDragging
              ? "border-tint bg-tint/5"
              : "border-separator hover:border-tint/50 hover:bg-fill-2"
          )}
        >
          <Upload
            className={cn(
              "mb-4 h-10 w-10 transition-colors",
              isDragging ? "text-tint" : "text-label-secondary"
            )}
          />
          <h3 className="text-label text-headline mb-1">
            {isDragging ? "Drop your file here" : "Drag, drop or paste your image"}
          </h3>
          <p className="text-label-secondary text-footnote mb-4">or click to browse local files</p>
          <input
            type="file"
            ref={inputRef}
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
              inputRef.current?.click();
            }}
            disabled={isUploading}
            size="sm"
            className="text-caption h-8 font-semibold"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Uploading...
              </>
            ) : (
              "Select File"
            )}
          </Button>
        </div>
      </div>

      {/* Requirements low-contrast subtle footer */}
      <div className="border-separator text-label-secondary text-footnote mt-6 flex justify-between border-t pt-4">
        <span>Maximum size: 5MB</span>
        <span>Formats: PNG, JPG, GIF, WEBP, SVG</span>
        <span>Directly embeds in your content</span>
      </div>
    </div>
  );
}
