"use client";
// src/components/wiki-os/editor/ImageSearchModal.tsx
// Modal for searching, uploading, and inserting images into the wiki editor.

import { useState, useCallback, useEffect, useRef } from "react";
import { Xmark as X, MediaImage as ImageIcon, Upload } from "iconoir-react";
import { ImageSearchGrid, type ImageResult } from "~/components/wiki-os/editor/ImageSearchGrid";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import { Input, fieldStyles } from "~/components/ui/input";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Textarea } from "~/components/ui/textarea";

interface ImageSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (wikitext: string) => void;
}

type ModalTab = "search" | "upload";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/svg+xml", "image/webp"];
const MAX_SIZE_MB = 10;

export function ImageSearchModal({ isOpen, onClose, onInsert }: ImageSearchModalProps) {
  const [tab, setTab] = useState<ModalTab>("search");
  const [selected, setSelected] = useState<ImageResult | null>(null);
  const [caption, setCaption] = useState("");
  const [size, setSize] = useState("thumb");
  const [align, setAlign] = useState("right");

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFilename, setUploadFilename] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = api.wikios.uploadFile.useMutation();

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      // oxlint-disable-next-line
      setSelected(null);
      setCaption("");
      setSize("thumb");
      setAlign("right");
      setTab("search");
      setUploadFile(null);
      setUploadFilename("");
      setUploadDescription("");
      setUploadPreview(null);
    }
  }, [isOpen]);

  const handleInsert = useCallback(() => {
    if (!selected) return;
    const name = selected.title.replace(/^File:/, "");
    const parts = [`File:${name}`];
    if (size) parts.push(size);
    if (align && align !== "none") parts.push(align);
    if (caption.trim()) parts.push(caption.trim());
    const wikitext = `[[${parts.join("|")}]]`;
    onInsert(wikitext);
    setSelected(null);
    setCaption("");
    onClose();
  }, [selected, caption, size, align, onInsert, onClose]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      alert("Unsupported file type. Allowed: JPG, PNG, GIF, SVG, WebP");
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      alert(`File too large. Maximum size is ${MAX_SIZE_MB}MB.`);
      return;
    }

    setUploadFile(file);
    setUploadFilename(file.name);

    // Generate preview
    const reader = new FileReader();
    reader.onload = () => setUploadPreview(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleUpload = useCallback(async () => {
    if (!uploadFile || !uploadFilename.trim()) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1]!;
      try {
        const result = await uploadMutation.mutateAsync({
          filename: uploadFilename,
          fileBase64: base64,
          description: uploadDescription,
          comment: "Uploaded via WikiOS",
        });

        if (result.success) {
          // Auto-insert the uploaded file
          const name = result.filename;
          const parts = [`File:${name}`];
          parts.push("thumb");
          parts.push("right");
          if (uploadDescription.trim()) parts.push(uploadDescription.trim());
          onInsert(`[[${parts.join("|")}]]`);
          onClose();
        }
      } catch (err) {
        console.error("Upload failed:", err);
      }
    };
    reader.readAsDataURL(uploadFile);
  }, [uploadFile, uploadFilename, uploadDescription, uploadMutation, onInsert, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="flex max-h-[85vh] max-w-[95vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[720px]"
      >
        <div className="border-separator flex items-center gap-3 border-b px-4 py-3">
          <DialogTitle className="text-headline flex items-center gap-2">
            <ImageIcon className="text-tint size-4" aria-hidden="true" />
            Insert Image
          </DialogTitle>

          <SegmentedControl
            aria-label="Image source"
            size="sm"
            className="ml-auto"
            value={tab}
            onValueChange={setTab}
            options={[
              { value: "search", label: "Search" },
              { value: "upload", label: "Upload", icon: <Upload aria-hidden="true" /> },
            ]}
          />

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close"
            className="text-label-secondary rounded-full"
          >
            <X aria-hidden="true" />
          </Button>
        </div>

        <div className="wikios-img-modal-body">
          {/* Search tab */}
          {tab === "search" && (
            <>
              <ImageSearchGrid onSelect={setSelected} selectedImage={selected} compact />

              {selected && (
                <div className="wikios-img-insert-form">
                  <div className="wikios-img-insert-preview">
                    <img
                      src={selected.thumbUrl ?? selected.url}
                      alt={selected.title}
                      referrerPolicy="no-referrer"
                    />
                    <span className="wikios-img-insert-name">
                      {selected.title.replace(/^File:/, "")}
                    </span>
                  </div>

                  <div className="wikios-img-insert-fields">
                    <label className="wikios-img-insert-label">
                      Caption
                      <Input
                        type="text"
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        placeholder="Image caption..."
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleInsert();
                        }}
                      />
                    </label>

                    <div className="wikios-img-insert-row">
                      <label className="wikios-img-insert-label">
                        Size
                        <select
                          value={size}
                          onChange={(e) => setSize(e.target.value)}
                          className={cn(
                            fieldStyles,
                            "rounded-control text-body h-(--control-height) w-full cursor-pointer px-3"
                          )}
                        >
                          <option value="thumb">Thumbnail</option>
                          <option value="frame">Frame</option>
                          <option value="frameless">Frameless</option>
                          <option value="">Full size</option>
                        </select>
                      </label>
                      <label className="wikios-img-insert-label">
                        Align
                        <select
                          value={align}
                          onChange={(e) => setAlign(e.target.value)}
                          className={cn(
                            fieldStyles,
                            "rounded-control text-body h-(--control-height) w-full cursor-pointer px-3"
                          )}
                        >
                          <option value="right">Right</option>
                          <option value="left">Left</option>
                          <option value="center">Center</option>
                          <option value="none">None</option>
                        </select>
                      </label>
                    </div>

                    <Button onClick={handleInsert}>Insert Image</Button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Upload tab */}
          {tab === "upload" && (
            <div className="wikios-img-modal-upload-container">
              {/* Drop zone / file picker */}
              <div
                className={cn("wikios-img-modal-dropzone", uploadPreview && "has-preview")}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ALLOWED_TYPES.join(",")}
                  onChange={handleFileSelect}
                  style={{ display: "none" }}
                />
                {uploadPreview ? (
                  <img src={uploadPreview} alt="Preview" className="wikios-img-modal-preview-img" />
                ) : (
                  <>
                    <Upload className="wikios-img-modal-upload-icon h-8 w-8" />
                    <p className="wikios-img-modal-upload-text">
                      Click to select a file or drag and drop
                    </p>
                    <p className="wikios-img-modal-upload-subtext">
                      JPG, PNG, GIF, SVG, WebP &mdash; max {MAX_SIZE_MB}MB
                    </p>
                  </>
                )}
              </div>

              {uploadFile && (
                <div className="wikios-img-modal-upload-fields">
                  <label className="wikios-img-modal-field-label">
                    Filename
                    <Input
                      type="text"
                      value={uploadFilename}
                      onChange={(e) => setUploadFilename(e.target.value)}
                    />
                  </label>
                  <label className="wikios-img-modal-field-label">
                    Description / Caption
                    <Textarea
                      value={uploadDescription}
                      onChange={(e) => setUploadDescription(e.target.value)}
                      placeholder="Describe this file..."
                      rows={3}
                    />
                  </label>

                  <Button
                    disabled={!uploadFilename.trim() || uploadMutation.isPending}
                    onClick={handleUpload}
                  >
                    {uploadMutation.isPending ? "Uploading..." : "Upload & Insert"}
                  </Button>

                  {uploadMutation.isError && (
                    <p className="wikios-img-modal-error-text">
                      Upload failed: {uploadMutation.error.message}
                    </p>
                  )}
                  {uploadMutation.isSuccess && (
                    <p className="wikios-img-modal-success-text">Upload successful!</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
