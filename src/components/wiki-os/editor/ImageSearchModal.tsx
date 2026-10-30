"use client";
// Modal for searching, uploading, and inserting images into the wiki editor.

import { useState, useCallback, useRef } from "react";
import { Xmark as X, MediaImage as ImageIcon, Upload } from "iconoir-react";
import { ImageInsertForm, imageWikitext } from "~/components/wiki-os/editor/ImageInsertForm";
import { useFiltersOpen } from "~/components/wiki-os/media-search/useFiltersOpen";
import type { CommonsImage } from "~/components/wiki-os/media-search/types";
import { WikiRepositoryTab } from "~/components/wiki-os/media-search/WikiRepositoryTab";
import { MAX_UPLOAD_BYTES } from "~/lib/wiki-os/config";
import {
  describeWarnings,
  postUpload,
  UPLOAD_FIELD_LIMITS,
  uploadSizeProblem,
} from "~/lib/wiki-os/upload-api";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Textarea } from "~/components/ui/textarea";

interface ImageSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (wikitext: string) => void;
}

type ModalTab = "search" | "upload";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/svg+xml", "image/webp"];
const MAX_SIZE_MB = MAX_UPLOAD_BYTES / 1_000_000;

/** Mounted only while open, so every opening starts from a fresh form. */
export function ImageSearchModal(props: ImageSearchModalProps) {
  return props.isOpen ? <ImageSearchModalContent {...props} /> : null;
}

function ImageSearchModalContent({ isOpen, onClose, onInsert }: ImageSearchModalProps) {
  const [tab, setTab] = useState<ModalTab>("search");
  const [selected, setSelected] = useState<CommonsImage | null>(null);
  const { isCategoryExpanded, onToggleFilters } = useFiltersOpen();

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFilename, setUploadFilename] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadLicense, setUploadLicense] = useState("");
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  /** MediaWiki's warnings for this upload, as sentences: the uploader may go on anyway. */
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInsert = (wikitext: string) => {
    onInsert(wikitext);
    onClose();
  };

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      alert("Unsupported file type. Allowed: JPG, PNG, GIF, SVG, WebP");
      return;
    }
    const tooLarge = uploadSizeProblem(file);
    if (tooLarge) {
      alert(tooLarge);
      return;
    }

    setUploadFile(file);
    setUploadFilename(file.name);
    setUploadError(null);
    setUploadWarnings([]);

    // Generate preview
    const reader = new FileReader();
    reader.onload = () => setUploadPreview(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  /** Upload the file; a warning stops it until the uploader says to go on (`ignoreWarnings`). */
  const handleUpload = useCallback(
    async (ignoreWarnings: boolean) => {
      if (!uploadFile || !uploadFilename.trim()) return;
      setUploading(true);
      setUploadError(null);
      setUploadWarnings([]);
      try {
        const result = await postUpload(uploadFile, {
          filename: uploadFilename,
          description: uploadDescription,
          license: uploadLicense,
          ignoreWarnings,
        });
        if (result.result === "Warning") {
          setUploadWarnings(describeWarnings(result.warnings));
          return;
        }
        // Auto-insert the uploaded file
        const parts = [`File:${result.filename}`, "thumb", "right"];
        if (uploadDescription.trim()) parts.push(uploadDescription.trim());
        onInsert(`[[${parts.join("|")}]]`);
        onClose();
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "The upload failed.");
      } finally {
        setUploading(false);
      }
    },
    [uploadFile, uploadFilename, uploadDescription, uploadLicense, onInsert, onClose]
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0 transition-[max-width] duration-300 ease-in-out",
          tab === "upload"
            ? "max-h-[85vh] max-w-[95vw] sm:max-w-[720px]"
            : cn("h-[88vh] max-h-[92vh]", isCategoryExpanded ? "max-w-7xl" : "max-w-5xl")
        )}
        onEscapeKeyDown={(e) => {
          // Escape first closes the detail panel, then the dialog.
          if (tab === "search" && selected) {
            e.preventDefault();
            setSelected(null);
          }
        }}
      >
        <div className="border-separator flex items-center gap-3 border-b px-4 py-3">
          <DialogTitle className="text-headline flex items-center gap-2">
            <ImageIcon className="text-tint size-4" aria-hidden="true" />
            Insert image
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

        <div
          className={tab === "upload" ? "wikios-img-modal-body" : "flex min-h-0 flex-1 flex-col"}
        >
          {/* Search tab: the site-wide repository picker, limited to what an article can hold */}
          {tab === "search" && (
            <>
              <WikiRepositoryTab
                mode="wikitext"
                selectedImageObj={selected}
                onSelectImage={setSelected}
                onDoubleClickConfirm={() => selected && handleInsert(imageWikitext(selected.title))}
                isCategoryExpanded={isCategoryExpanded}
                onToggleFilters={onToggleFilters}
              />
              {selected && <ImageInsertForm image={selected} onInsert={handleInsert} />}
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
                      onChange={(e) => {
                        setUploadFilename(e.target.value);
                        setUploadWarnings([]);
                      }}
                      maxLength={UPLOAD_FIELD_LIMITS.filename}
                    />
                  </label>
                  <label className="wikios-img-modal-field-label">
                    Description / Caption
                    <Textarea
                      value={uploadDescription}
                      onChange={(e) => setUploadDescription(e.target.value)}
                      placeholder="Describe this file..."
                      maxLength={UPLOAD_FIELD_LIMITS.description}
                      rows={3}
                    />
                  </label>
                  <label className="wikios-img-modal-field-label">
                    License
                    <Input
                      type="text"
                      value={uploadLicense}
                      onChange={(e) => setUploadLicense(e.target.value)}
                      placeholder="e.g. {{PD-self}}, or who made it and under which terms"
                      maxLength={UPLOAD_FIELD_LIMITS.license}
                    />
                  </label>

                  {uploadWarnings.length > 0 && (
                    <div role="alert" className="wikios-img-modal-error-text">
                      {uploadWarnings.map((warning) => (
                        <p key={warning}>{warning}</p>
                      ))}
                    </div>
                  )}

                  <Button
                    disabled={!uploadFilename.trim() || uploading}
                    onClick={() => void handleUpload(uploadWarnings.length > 0)}
                  >
                    {uploading
                      ? "Uploading..."
                      : uploadWarnings.length > 0
                        ? "Upload anyway"
                        : "Upload & Insert"}
                  </Button>

                  {uploadError && (
                    <p role="alert" className="wikios-img-modal-error-text">
                      Upload failed: {uploadError}
                    </p>
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
