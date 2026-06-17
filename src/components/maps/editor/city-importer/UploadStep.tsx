"use client";

import React, { useRef, useCallback } from "react";
import { Upload, FileText, Loader2, AlertCircle } from "lucide-react";
import type { useCityImporter } from "~/hooks/useCityImporter";

interface UploadStepProps {
  importer: ReturnType<typeof useCityImporter>;
}

export function UploadStep({ importer }: UploadStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        void importer.handleFile(file);
      }
    },
    [importer]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) {
        void importer.handleFile(file);
      }
    },
    [importer]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-foreground text-sm font-medium">Upload City Data</h3>
        <p className="text-muted-foreground mt-1 text-xs">
          Upload a CSV, TSV, JSON, or SVG file containing your city data. Each row/dot becomes a city point
          on your country map.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => !importer.isProcessing && inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors ${
          importer.isProcessing
            ? "pointer-events-none opacity-50"
            : "border-border hover:border-primary/50 hover:bg-accent/50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.tsv,.json,.svg"
          className="hidden"
          onChange={handleChange}
        />

        {importer.isProcessing ? (
          <>
            <Loader2 className="text-primary mb-3 h-8 w-8 animate-spin" />
            <p className="text-foreground text-sm font-medium">Parsing...</p>
            <p className="text-muted-foreground mt-1 text-xs">Reading city data from file</p>
          </>
        ) : (
          <>
            <Upload className="text-muted-foreground mb-3 h-8 w-8" />
            <p className="text-foreground text-sm font-medium">
              Drag & drop or click to upload
            </p>
            <div className="text-muted-foreground mt-2 flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" /> CSV
              </span>
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" /> TSV
              </span>
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" /> JSON
              </span>
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" /> SVG
              </span>
            </div>
          </>
        )}
      </div>

      {/* Error display */}
      {importer.error && (
        <div className="bg-destructive/10 text-destructive flex items-start gap-2 rounded-lg border border-destructive/20 px-3 py-2 text-xs">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{importer.error}</span>
        </div>
      )}

      {/* Help block */}
      <div className="bg-card rounded-lg border border-border p-3 space-y-2">
        <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
          Expected columns
        </p>
        <div className="text-muted-foreground text-xs space-y-1">
          <p>
            <span className="text-foreground font-medium">Required:</span>{" "}
            <code className="bg-muted rounded px-1">name</code>,{" "}
            <code className="bg-muted rounded px-1">lat</code> (or{" "}
            <code className="bg-muted rounded px-1">latitude</code>),{" "}
            <code className="bg-muted rounded px-1">lng</code> (or{" "}
            <code className="bg-muted rounded px-1">lon</code> /{" "}
            <code className="bg-muted rounded px-1">longitude</code>)
          </p>
          <p>
            <span className="text-foreground font-medium">Optional:</span>{" "}
            <code className="bg-muted rounded px-1">type</code>,{" "}
            <code className="bg-muted rounded px-1">population</code>,{" "}
            <code className="bg-muted rounded px-1">foundedYear</code>,{" "}
            <code className="bg-muted rounded px-1">elevation</code>,{" "}
            <code className="bg-muted rounded px-1">capital</code>,{" "}
            <code className="bg-muted rounded px-1">regionalCapital</code>,{" "}
            <code className="bg-muted rounded px-1">regionId</code>,{" "}
            <code className="bg-muted rounded px-1">wikiPageTitle</code>
          </p>
          <p className="text-muted-foreground/70">
            JSON: array of objects. CSV/TSV: header row required.
          </p>
        </div>
      </div>
    </div>
  );
}
