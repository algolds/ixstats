"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { useState } from "react";
import { isBuiltinCharge } from "./builtin-charges";
import { useVexelEditor } from "./VexelEditorProvider";

interface ExportDialogProps {
  onClose: () => void;
}

const SVG_MIME = "image/svg+xml;charset=utf-8";

function download(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
}

export default function ExportDialog({ onClose }: ExportDialogProps) {
  const { composition } = useVexelEditor();
  const [exporting, setExporting] = useState(false);

  const getSvgString = (): string | null => {
    const svgElement = document.getElementById("vexel-shield-canvas");
    if (!svgElement) return null;
    return new XMLSerializer().serializeToString(svgElement);
  };

  const handleDownloadSvg = () => {
    const svgString = getSvgString();
    if (!svgString) return;

    const url = URL.createObjectURL(new Blob([svgString], { type: SVG_MIME }));
    download(url, "coat-of-arms.svg");
    URL.revokeObjectURL(url);
  };

  const handleDownloadPng = (size: number) => {
    const svgString = getSvgString();
    if (!svgString) return;

    setExporting(true);

    const url = URL.createObjectURL(new Blob([svgString], { type: SVG_MIME }));
    const img = new Image();

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");

        if (ctx) {
          ctx.clearRect(0, 0, size, size);
          ctx.drawImage(img, 0, 0, size, size);
          download(canvas.toDataURL("image/png"), `coat-of-arms-${size}px.png`);
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

  const customChargesUsed = (composition.shield.charges ?? []).filter(
    (c) => !isBuiltinCharge(c.chargeId)
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="text-label-secondary text-footnote max-w-md gap-0 p-6">
        <DialogHeader className="border-separator mb-4 border-b pb-4">
          <DialogTitle className="text-body">Export achievements</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <FacetList>
            <FacetListSection header="Download vectors">
              <FacetRow
                title="Download vector SVG"
                trailing={<Badge variant="default">SVG</Badge>}
                onClick={handleDownloadSvg}
              />
            </FacetListSection>
            <FacetListSection header="Download raster images">
              <FacetRow
                title="Small PNG"
                subtitle={<span className="tabular-nums">256 × 256 px</span>}
                disabled={exporting}
                onClick={() => handleDownloadPng(256)}
              />
              <FacetRow
                title="Large PNG"
                subtitle={<span className="tabular-nums">1024 × 1024 px</span>}
                disabled={exporting}
                onClick={() => handleDownloadPng(1024)}
              />
            </FacetListSection>
          </FacetList>

          {customChargesUsed.length > 0 && (
            <div className="rounded-row bg-yellow/15 text-footnote text-yellow-ink p-3 leading-relaxed">
              <span className="mb-1 block font-semibold">Attribution required</span>
              This composition includes charges imported from Wikimedia Commons:
              <ul className="text-label-secondary text-footnote mt-1 list-disc space-y-0.5 pl-4 font-mono">
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
