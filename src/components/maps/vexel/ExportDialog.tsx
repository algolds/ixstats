"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Eyebrow } from "~/components/ui/eyebrow";
import React, { useState } from "react";
import { useVexelEditor } from "./VexelEditorProvider";

interface ExportDialogProps {
  onClose: () => void;
}

export default function ExportDialog({ onClose }: ExportDialogProps) {
  // oxlint-disable-next-line eslint/no-unused-vars
  const { blazon, composition } = useVexelEditor();
  const [exporting, setExporting] = useState(false);

  const getSvgString = (): string | null => {
    const svgElement = document.getElementById("vexel-shield-canvas");
    if (!svgElement) return null;
    return new XMLSerializer().serializeToString(svgElement);
  };

  const handleDownloadSvg = () => {
    const svgString = getSvgString();
    if (!svgString) return;

    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "coat-of-arms.svg";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPng = (size: number) => {
    const svgString = getSvgString();
    if (!svgString) return;

    setExporting(true);

    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");

        if (ctx) {
          // Fill transparent background or keep transparent depending on choice
          ctx.clearRect(0, 0, size, size);
          ctx.drawImage(img, 0, 0, size, size);

          const pngUrl = canvas.toDataURL("image/png");
          const link = document.createElement("a");
          link.href = pngUrl;
          link.download = `coat-of-arms-${size}px.png`;
          link.click();
        }
      } catch (err) {
        console.error("Failed to render PNG", err);
      } finally {
        URL.revokeObjectURL(url);
        setExporting(false);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      setExporting(false);
    };

    img.src = url;
  };

  // Find if custom Commons-imported charges are used
  const customChargesUsed = (composition.shield.charges ?? []).filter(
    (c) => !["star", "cross", "fleur-de-lis", "lion", "eagle"].includes(c.chargeId)
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="facet-modal text-muted-foreground max-w-md gap-0 rounded-2xl p-6 text-xs">
        <DialogHeader className="border-border mb-4 border-b pb-4">
          <DialogTitle className="text-sm">Export achievements</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Format selection */}
          <div className="space-y-2">
            <Eyebrow>Download Vectors</Eyebrow>
            <button
              onClick={handleDownloadSvg}
              className="border-border bg-muted hover:border-border hover:bg-accent flex w-full items-center justify-between rounded-lg border px-4 py-2.5 text-left font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] outline-none"
            >
              <span>Download Vector SVG</span>
              <span className="border-border text-muted-foreground rounded border px-1.5 py-0.5 font-mono text-xs">
                SVG
              </span>
            </button>
          </div>

          <div className="space-y-2">
            <Eyebrow>Download Raster Images</Eyebrow>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleDownloadPng(256)}
                disabled={exporting}
                className="border-border bg-muted hover:border-border hover:bg-accent flex flex-col items-center gap-1 rounded-lg border px-4 py-2.5 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] disabled:opacity-50"
              >
                <span>Small PNG</span>
                <span className="text-muted-foreground font-mono text-xs">256 x 256 px</span>
              </button>

              <button
                onClick={() => handleDownloadPng(1024)}
                disabled={exporting}
                className="border-border bg-muted hover:border-border hover:bg-accent flex flex-col items-center gap-1 rounded-lg border px-4 py-2.5 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] disabled:opacity-50"
              >
                <span>Large PNG</span>
                <span className="text-muted-foreground font-mono text-xs">1024 x 1024 px</span>
              </button>
            </div>
          </div>

          {/* Commons attribution notice */}
          {customChargesUsed.length > 0 && (
            <div className="rounded-lg border border-amber-500/10 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-500">
              <span className="mb-1 block font-bold">Attribution required</span>
              This composition includes charges imported from Wikimedia Commons:
              <ul className="text-muted-foreground mt-1 list-disc space-y-0.5 pl-4 font-mono text-xs">
                {customChargesUsed.map((c, i) => (
                  <li key={i}>{c.chargeId}</li>
                ))}
              </ul>
              Please preserve licensing and author attributions when publishing these arms.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
