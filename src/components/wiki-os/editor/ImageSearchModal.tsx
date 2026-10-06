"use client";
// Modal for searching, uploading, and inserting images into the wiki editor.

import { useState, useCallback, useEffect, useRef } from "react";
import { Xmark as X, MediaImage as ImageIcon, Upload } from "iconoir-react";
import { ImageSearchGrid, type ImageResult } from "~/components/wiki-os/editor/ImageSearchGrid";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";

interface ImageSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (wikitext: string) => void;
}

type ModalTab = "search" | "upload";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/svg+xml", "image/webp"];
const MAX_SIZE_MB = MAX_UPLOAD_BYTES / 1_000_000;
/** Select items cannot carry an empty value; "Full size" is the empty wikitext size. */
const FULL_SIZE = "full";

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
  const [uploadLicense, setUploadLicense] = useState("");
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  /** MediaWiki's warnings for this upload, as sentences: the uploader may go on anyway. */
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setUploadLicense("");
      setUploadPreview(null);
      setUploadError(null);
      setUploadWarnings([]);
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
        className="flex max-h-[85vh] max-w-[95vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[720px]"
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
                      <div className="wikios-img-insert-label">
                        <span id="wikios-img-insert-size">Size</span>
                        <Select
                          value={size || FULL_SIZE}
                          onValueChange={(v) => setSize(v === FULL_SIZE ? "" : v)}
                        >
                          <SelectTrigger
                            aria-labelledby="wikios-img-insert-size"
                            className="w-full"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="thumb">Thumbnail</SelectItem>
                            <SelectItem value="frame">Frame</SelectItem>
                            <SelectItem value="frameless">Frameless</SelectItem>
                            <SelectItem value={FULL_SIZE}>Full size</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="wikios-img-insert-label">
                        <span id="wikios-img-insert-align">Align</span>
                        <Select value={align} onValueChange={setAlign}>
                          <SelectTrigger
                            aria-labelledby="wikios-img-insert-align"
                            className="w-full"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="right">Right</SelectItem>
                            <SelectItem value="left">Left</SelectItem>
                            <SelectItem value="center">Center</SelectItem>
                            <SelectItem value="none">None</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Button onClick={handleInsert}>Insert image</Button>
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
