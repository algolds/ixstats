"use client";

import React, { memo, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileImage, FileText, Loader2 } from "lucide-react";
import type { useProvinceImporter } from "~/hooks/useProvinceImporter";

interface UploadStepProps {
  importer: ReturnType<typeof useProvinceImporter>;
}

export const UploadStep = memo(function UploadStep({ importer }: UploadStepProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) {
        importer.handleUpload(file);
      }
    },
    [importer]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/svg+xml": [".svg"],
      "image/png": [".png"],
    },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024, // 20MB
    disabled: importer.isProcessing,
  });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-foreground">Upload Province Map</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Upload an SVG or PNG file containing your province/subdivision boundaries.
          SVG files from Inkscape work best — provinces are detected from path groups.
        </p>
      </div>

      <div
        {...getRootProps()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors ${
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-accent/50"
        } ${importer.isProcessing ? "pointer-events-none opacity-50" : ""}`}
      >
        <input {...getInputProps()} />

        {importer.isProcessing ? (
          <>
            <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-foreground">Processing...</p>
            <p className="mt-1 text-xs text-muted-foreground">Parsing provinces from uploaded file</p>
          </>
        ) : (
          <>
            <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">
              {isDragActive ? "Drop file here" : "Drag & drop or click to upload"}
            </p>
            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
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
        <div className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          This country has {importer.existingSubdivisions.length} existing subdivision{importer.existingSubdivisions.length !== 1 ? "s" : ""}.
          You can choose to replace them in the final step.
        </div>
      )}

      <div className="text-[10px] text-muted-foreground">
        <strong>Tips:</strong> For best results, use an Inkscape SVG where each province is a
        separate path or group. Name your groups/paths with province names. For PNG files,
        use distinct fill colors for each province.
      </div>
    </div>
  );
});
