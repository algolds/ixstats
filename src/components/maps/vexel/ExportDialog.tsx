"use client";

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="animate-in fade-in zoom-in-95 w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-6 text-xs text-zinc-300 shadow-2xl duration-150">
        <header className="mb-4 flex items-center justify-between border-b border-white/5 pb-4">
          <h2 className="text-sm font-bold tracking-wider text-amber-500">
            🛡️ Export Achievements
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-100"
          >
            ✕
          </button>
        </header>

        <div className="space-y-4">
          {/* Format selection */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-zinc-500 uppercase">Download Vectors</span>
            <button
              onClick={handleDownloadSvg}
              className="flex w-full items-center justify-between rounded-lg border border-white/5 bg-zinc-800 px-4 py-2.5 text-left font-semibold transition-all outline-none hover:border-white/10 hover:bg-zinc-700"
            >
              <span>Download Vector SVG</span>
              <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] text-emerald-400">
                SVG
              </span>
            </button>
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-bold text-zinc-500 uppercase">
              Download Raster Images
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleDownloadPng(256)}
                disabled={exporting}
                className="flex flex-col items-center gap-1 rounded-lg border border-white/5 bg-zinc-800 px-4 py-2.5 font-semibold transition-all hover:border-white/10 hover:bg-zinc-700 disabled:opacity-50"
              >
                <span>Small PNG</span>
                <span className="font-mono text-[9px] text-zinc-500">256 x 256 px</span>
              </button>

              <button
                onClick={() => handleDownloadPng(1024)}
                disabled={exporting}
                className="flex flex-col items-center gap-1 rounded-lg border border-white/5 bg-zinc-800 px-4 py-2.5 font-semibold transition-all hover:border-white/10 hover:bg-zinc-700 disabled:opacity-50"
              >
                <span>Large PNG</span>
                <span className="font-mono text-[9px] text-zinc-500">1024 x 1024 px</span>
              </button>
            </div>
          </div>

          {/* Commons attribution notice */}
          {customChargesUsed.length > 0 && (
            <div className="rounded-lg border border-amber-500/10 bg-amber-500/5 p-3 text-[10px] leading-relaxed text-amber-400/90">
              <span className="mb-1 block font-bold">📢 ATTRIBUTION REQUIRED</span>
              This composition includes charges imported from Wikimedia Commons:
              <ul className="mt-1 list-disc space-y-0.5 pl-4 font-mono text-[9px] text-zinc-400">
                {customChargesUsed.map((c, i) => (
                  <li key={i}>{c.chargeId}</li>
                ))}
              </ul>
              Please preserve licensing and author attributions when publishing these arms.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
