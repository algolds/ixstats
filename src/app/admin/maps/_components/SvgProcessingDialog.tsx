"use client";

/**
 * SvgProcessingDialog - Modal for processing an uploaded SVG.
 * Shows processing status, extracted features, country matches,
 * and allows preview + commit.
 */

import { useState } from "react";
import { api } from "~/trpc/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Loader2, Check, X, AlertCircle, Eye, Upload } from "lucide-react";
import { SvgPreviewMap } from "./SvgPreviewMap";
import type { FeatureCollection } from "geojson";

interface ProcessingDialogProps {
  uploadId: string | null;
  layerType: string;
  fileName: string;
  onClose: () => void;
  onCommitted: () => void;
}

type ProcessResult = {
  featureCount: number;
  layersFound: string[];
  log: string[];
  countryMatches: Record<string, { countryId: string; countryName: string; matchType: string }>;
  features: Array<{
    featureId: string;
    displayName: string;
    areaSqKm: number;
    centroid: [number, number];
    countryMatch: { countryId: string; countryName: string; matchType: string } | null;
  }>;
};

export function SvgProcessingDialog({
  uploadId,
  layerType,
  fileName,
  onClose,
  onCommitted,
}: ProcessingDialogProps) {
  const [processResult, setProcessResult] = useState<ProcessResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<FeatureCollection | null>(null);

  const utils = api.useUtils();

  const processMutation = api.geoAdmin.processSvgUpload.useMutation({
    onSuccess: (data) => setProcessResult(data),
  });

  const previewQuery = api.geoAdmin.previewSvgUpload.useQuery(
    { uploadId: uploadId ?? "" },
    { enabled: showPreview && !!uploadId && !!processResult }
  );

  const commitMutation = api.geoAdmin.commitSvgUpload.useMutation({
    onSuccess: () => {
      utils.geoCore.getMapStats.invalidate();
      utils.geoAdmin.getSvgUploadHistory.invalidate();
      utils.geoCore.getWorldMap.invalidate();
      utils.geoCore.getMapBundle.invalidate();
      onCommitted();
    },
  });

  const handleProcess = () => {
    if (uploadId) {
      processMutation.mutate({ uploadId });
    }
  };

  const handlePreview = () => {
    setShowPreview(true);
    if (previewQuery.data) {
      setPreviewData(previewQuery.data.geojson);
    }
  };

  // Update preview data when query resolves
  if (showPreview && previewQuery.data && !previewData) {
    setPreviewData(previewQuery.data.geojson);
  }

  const handleCommit = () => {
    if (uploadId) {
      commitMutation.mutate({ uploadId });
    }
  };

  const isProcessing = processMutation.isPending;
  const isCommitting = commitMutation.isPending;

  return (
    <Dialog open={!!uploadId} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Process SVG Upload
            <Badge variant="outline">{layerType}</Badge>
          </DialogTitle>
          <p className="text-muted-foreground text-sm">{fileName}</p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1: Process */}
          {!processResult && !isProcessing && (
            <div className="border-border rounded-lg border p-6 text-center">
              <p className="text-foreground/80 mb-4 text-sm">
                Click Process to extract features from the SVG and convert to GeoJSON.
              </p>
              <Button onClick={handleProcess}>
                <Upload className="mr-2 h-4 w-4" />
                Process SVG
              </Button>
            </div>
          )}

          {/* Processing spinner */}
          {isProcessing && (
            <div className="flex items-center justify-center gap-3 py-8">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              <span className="text-foreground/80 text-sm">Processing SVG...</span>
            </div>
          )}

          {/* Processing error */}
          {processMutation.isError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
              <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
                <AlertCircle className="h-4 w-4" />
                {processMutation.error.message}
              </div>
            </div>
          )}

          {/* Step 2: Results */}
          {processResult && (
            <>
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-900/20">
                  <div className="text-xs text-emerald-600 dark:text-emerald-400">Features</div>
                  <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                    {processResult.featureCount}
                  </div>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
                  <div className="text-xs text-blue-600 dark:text-blue-400">Matched</div>
                  <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
                    {Object.keys(processResult.countryMatches).length}
                  </div>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
                  <div className="text-xs text-amber-600 dark:text-amber-400">Unmatched</div>
                  <div className="text-lg font-bold text-amber-700 dark:text-amber-300">
                    {processResult.featureCount - Object.keys(processResult.countryMatches).length}
                  </div>
                </div>
              </div>

              {/* Feature list */}
              <ScrollArea className="h-[250px]">
                <div className="space-y-1">
                  {processResult.features.map((f) => (
                    <div
                      key={f.featureId}
                      className="hover:bg-accent flex items-center justify-between rounded px-3 py-1.5 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        {f.countryMatch ? (
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-amber-500" />
                        )}
                        <span className="font-medium">{f.displayName}</span>
                      </div>
                      <div className="text-muted-foreground flex items-center gap-3 text-xs">
                        {f.countryMatch && (
                          <Badge variant="secondary" className="text-[10px]">
                            {f.countryMatch.matchType === "exact" ? "exact" : "fuzzy"} →{" "}
                            {f.countryMatch.countryName}
                          </Badge>
                        )}
                        <span>{f.areaSqKm.toLocaleString()} km²</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Preview map */}
              {showPreview && (
                <SvgPreviewMap geojson={previewData} layerType={layerType} height="300px" />
              )}

              {/* Processing log */}
              <details className="text-muted-foreground text-xs">
                <summary className="hover:text-foreground cursor-pointer">
                  Processing log ({processResult.log.length} entries)
                </summary>
                <pre className="bg-muted mt-2 max-h-32 overflow-auto rounded p-2">
                  {processResult.log.join("\n")}
                </pre>
              </details>
            </>
          )}

          {/* Commit error */}
          {commitMutation.isError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
              <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
                <AlertCircle className="h-4 w-4" />
                {commitMutation.error.message}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isCommitting}>
            Cancel
          </Button>
          {processResult && !showPreview && (
            <Button variant="outline" onClick={handlePreview}>
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </Button>
          )}
          {processResult && (
            <Button
              onClick={handleCommit}
              disabled={isCommitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isCommitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Committing...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Commit to Map
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
