"use client";
// src/components/wiki-os/editor/ImageSearchModal.tsx
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

interface ImageSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (wikitext: string) => void;
}

type ModalTab = "search" | "upload";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/svg+xml", "image/webp"];
const MAX_SIZE_MB = MAX_UPLOAD_BYTES / 1_000_000;

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

  if (!isOpen) return null;

  return (
    <div className="wikios-modal-backdrop" onClick={onClose}>
      <div className="wikios-img-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wikios-img-modal-header">
          <div className="wikios-img-modal-title">
            <ImageIcon className="h-4 w-4" />
            <span>Insert Image</span>
          </div>

          {/* Tabs */}
          <div className="wikios-img-modal-tabs">
            <button
              className={cn("wikios-img-modal-tab-btn", tab === "search" && "tab-search-active")}
              onClick={() => setTab("search")}
            >
              Search
            </button>
            <button
              className={cn("wikios-img-modal-tab-btn", tab === "upload" && "tab-upload-active")}
              onClick={() => setTab("upload")}
            >
              <Upload className="h-3 w-3" /> Upload
            </button>
          </div>

          <button onClick={onClose} className="wikios-quick-modal-close">
            <X className="h-4 w-4" />
          </button>
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
                      <input
                        type="text"
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        placeholder="Image caption..."
                        className="wikios-img-insert-input"
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
                          className="wikios-img-insert-select"
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
                          className="wikios-img-insert-select"
                        >
                          <option value="right">Right</option>
                          <option value="left">Left</option>
                          <option value="center">Center</option>
                          <option value="none">None</option>
                        </select>
                      </label>
                    </div>

                    <button onClick={handleInsert} className="wikios-img-insert-btn">
                      Insert Image
                    </button>
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
                    <input
                      type="text"
                      value={uploadFilename}
                      onChange={(e) => {
                        setUploadFilename(e.target.value);
                        setUploadWarnings([]);
                      }}
                      maxLength={UPLOAD_FIELD_LIMITS.filename}
                      className="wikios-img-modal-field-input"
                    />
                  </label>
                  <label className="wikios-img-modal-field-label">
                    Description / Caption
                    <textarea
                      value={uploadDescription}
                      onChange={(e) => setUploadDescription(e.target.value)}
                      placeholder="Describe this file..."
                      maxLength={UPLOAD_FIELD_LIMITS.description}
                      rows={3}
                      className="wikios-img-modal-field-textarea"
                    />
                  </label>
                  <label className="wikios-img-modal-field-label">
                    License
                    <input
                      type="text"
                      value={uploadLicense}
                      onChange={(e) => setUploadLicense(e.target.value)}
                      placeholder="e.g. {{PD-self}}, or who made it and under which terms"
                      maxLength={UPLOAD_FIELD_LIMITS.license}
                      className="wikios-img-modal-field-input"
                    />
                  </label>

                  {uploadWarnings.length > 0 && (
                    <div role="alert" className="wikios-img-modal-error-text">
                      {uploadWarnings.map((warning) => (
                        <p key={warning}>{warning}</p>
                      ))}
                    </div>
                  )}

                  <button
                    className="wikios-img-insert-btn"
                    disabled={!uploadFilename.trim() || uploading}
                    onClick={() => void handleUpload(uploadWarnings.length > 0)}
                  >
                    {uploading
                      ? "Uploading..."
                      : uploadWarnings.length > 0
                        ? "Upload anyway"
                        : "Upload & Insert"}
                  </button>

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
      </div>
    </div>
  );
}
