"use client";

import React, { memo, useCallback, useState, useRef } from "react";
import { Upload, MediaImage as FileImage, Page as FileText, SystemRestart as Loader2 } from "iconoir-react";
import type { useProvinceImporter } from "~/hooks/useProvinceImporter";

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
        <h3 className="text-foreground text-sm font-medium">Upload Province Map</h3>
        <p className="text-muted-foreground mt-1 text-xs">
          Upload an SVG or PNG file containing your province/subdivision boundaries. SVG files from
          Inkscape work best — provinces are detected from path groups.
        </p>
      </div>

      {/* Scope picker */}
      <div className="space-y-2">
        <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
          Import Scope
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: "both", label: "Provinces & Cities" },
            { id: "provinces", label: "Provinces Only" },
            { id: "cities", label: "Cities Only" },
          ].map((scope) => (
            <button
              key={scope.id}
              type="button"
              onClick={() => importer.setImportScope(scope.id as any)}
              className={`rounded-lg border px-3 py-2 text-center text-xs font-medium transition-all ${
                importer.importScope === scope.id
                  ? "border-primary bg-primary/10 text-primary shadow-sm"
                  : "border-border hover:bg-accent text-muted-foreground hover:text-foreground"
              }`}
            >
              {scope.label}
            </button>
          ))}
        </div>
      </div>

      <div
        onClick={() => !importer.isProcessing && fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors ${
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-accent/50"
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
            <Loader2 className="text-primary mb-3 h-8 w-8 animate-spin" />
            <p className="text-foreground text-sm font-medium">Processing...</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Parsing provinces from uploaded file
            </p>
          </>
        ) : (
          <>
            <Upload className="text-muted-foreground mb-3 h-8 w-8" />
            <p className="text-foreground text-sm font-medium">
              {isDragActive ? "Drop file here" : "Drag & drop or click to upload"}
            </p>
            <div className="text-muted-foreground mt-2 flex items-center gap-3 text-xs">
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
          This country has {importer.existingSubdivisions.length} existing subdivision
          {importer.existingSubdivisions.length !== 1 ? "s" : ""}. You can choose to replace them in
          the final step.
        </div>
      )}

      <div className="text-muted-foreground text-[10px]">
        <strong>Tips:</strong> For best results, use an Inkscape SVG where each province is a
        separate path or group. Name your groups/paths with province names. For PNG files, use
        distinct fill colors for each province.
      </div>
    </div>
  );
});
