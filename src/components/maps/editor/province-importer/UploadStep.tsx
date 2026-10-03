"use client";

import { Eyebrow } from "~/components/ui/eyebrow";
import React, { memo, useCallback, useState, useRef } from "react";
import {
  Upload,
  MediaImage as FileImage,
  Page as FileText,
  SystemRestart as Loader2,
} from "iconoir-react";
import type { useProvinceImporter } from "~/hooks/useProvinceImporter";
import { SegmentedControl } from "~/components/ui/segmented-control";

interface UploadStepProps {
  importer: ReturnType<typeof useProvinceImporter>;
}

export const UploadStep = memo(function UploadStep({ importer }: UploadStepProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = useCallback(
    (file?: File) => {
      if (
        file &&
        (file.type === "image/svg+xml" ||
          file.type === "image/png" ||
          file.name.endsWith(".svg") ||
          file.name.endsWith(".png"))
      ) {
        importer.handleUpload(file);
      }
    },
    [importer]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!importer.isProcessing) {
        setIsDragActive(true);
      }
    },
    [importer.isProcessing]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);
      if (importer.isProcessing) return;

      const file = e.dataTransfer.files?.[0];
      handleFile(file);
    },
    [importer.isProcessing, handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-label text-body font-medium">Upload province map</h3>
        <p className="text-label-secondary text-footnote mt-1">
          Upload an SVG or PNG file containing your province/subdivision boundaries. SVG files from
          Inkscape work best. Provinces are detected from path groups.
        </p>
      </div>

      {/* Scope picker */}
      <div className="space-y-2">
        <Eyebrow className="block">Import scope</Eyebrow>
        <SegmentedControl
          aria-label="Import scope"
          fullWidth
          size="sm"
          value={importer.importScope}
          onValueChange={(v) => importer.setImportScope(v as typeof importer.importScope)}
          options={[
            { value: "both", label: "Provinces & cities" },
            { value: "provinces", label: "Provinces only" },
            { value: "cities", label: "Cities only" },
          ]}
        />
      </div>

      <div
        onClick={() => !importer.isProcessing && fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`rounded-row flex cursor-pointer flex-col items-center justify-center border-2 border-dashed p-8 transition-colors ${
          isDragActive
            ? "border-tint bg-tint-fill"
            : "border-separator hover:border-tint/50 hover:bg-fill-3"
        } ${importer.isProcessing ? "pointer-events-none opacity-50" : ""}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".svg,.png,image/svg+xml,image/png"
          onChange={handleInputChange}
          className="hidden"
        />

        {importer.isProcessing ? (
          <>
            <Loader2 className="text-tint mb-3 h-8 w-8 animate-spin" />
            <p className="text-label text-body font-medium">Processing...</p>
            <p className="text-label-secondary text-footnote mt-1">
              Parsing provinces from uploaded file
            </p>
          </>
        ) : (
          <>
            <Upload className="text-label-secondary mb-3 h-8 w-8" />
            <p className="text-label text-body font-medium">
              {isDragActive ? "Drop file here" : "Drag & drop or click to upload"}
            </p>
            <div className="text-label-secondary text-footnote mt-2 flex items-center gap-3">
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" /> SVG
              </span>
              <span className="flex items-center gap-1">
                <FileImage className="h-3 w-3" /> PNG
              </span>
              <span>Max 20MB</span>
            </div>
          </>
        )}
      </div>

      {/* Existing subdivisions info */}
      {importer.existingSubdivisions.length > 0 && (
        <div className="border-separator rounded-control text-footnote text-yellow border px-3 py-2">
          This country has {importer.existingSubdivisions.length} existing subdivision
          {importer.existingSubdivisions.length !== 1 ? "s" : ""}. You can choose to replace them in
          the final step.
        </div>
      )}

      <div className="text-label-secondary text-footnote">
        <strong>Tips:</strong> For best results, use an Inkscape SVG where each province is a
        separate path or group. Name your groups/paths with province names. For PNG files, use
        distinct fill colors for each province.
      </div>
    </div>
  );
});
