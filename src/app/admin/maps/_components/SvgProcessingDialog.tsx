"use client";

/**
 * SvgProcessingDialog - Modal for processing an uploaded SVG.
 * Shows processing status, extracted features, country matches,
 * and allows preview + commit.
 */

import { useState } from "react";
import { api } from "~/trpc/react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { ScrollArea } from "~/components/ui/scroll-area";
import {
  SystemRestart as Loader2,
  Check,
  Xmark as X,
  WarningCircle as AlertCircle,
  Eye,
  Upload,
} from "iconoir-react";
import { SvgPreviewMap } from "./SvgPreviewMap";
import type { FeatureCollection } from "geojson";
import { Card } from "~/components/ui/card";

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
      utils.geoCore.getWorldMapPacked.invalidate();
      utils.geoCore.getMapBundle.invalidate();
      utils.geoCore.getMapBundleDetail.invalidate();
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
    <Sheet open={!!uploadId} onOpenChange={() => onClose()}>
      <SheetContent size="wide" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Process SVG Upload
            <Badge variant="outline">{layerType}</Badge>
          </SheetTitle>
          <p className="text-label-secondary text-body">{fileName}</p>
        </SheetHeader>

        <div className="space-y-4">
          {/* Step 1: Process */}
          {!processResult && !isProcessing && (
            <div className="border-separator rounded-control border p-6 text-center">
              <p className="text-label text-body mb-4">
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
              <Loader2 className="text-blue h-5 w-5 animate-spin" />
              <span className="text-label text-body">Processing SVG...</span>
            </div>
          )}

          {/* Processing error */}
          {processMutation.isError && (
            <div className="border-destructive/30 rounded-control border p-4">
              <div className="text-destructive text-body flex items-center gap-2">
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
                <Card className="rounded-control p-3">
                  <span className="text-stat-label text-label-secondary block">Features</span>
                  <div className="text-label text-title-3 tabular-nums">
                    {processResult.featureCount}
                  </div>
                </Card>
                <Card className="rounded-control p-3">
                  <span className="text-stat-label text-label-secondary block">Matched</span>
                  <div className="text-label text-title-3 tabular-nums">
                    {Object.keys(processResult.countryMatches).length}
                  </div>
                </Card>
                <Card className="rounded-control p-3">
                  <span className="text-stat-label text-label-secondary block">Unmatched</span>
                  <div className="text-label text-title-3 tabular-nums">
                    {processResult.featureCount - Object.keys(processResult.countryMatches).length}
                  </div>
                </Card>
              </div>

              {/* Feature list */}
              <ScrollArea className="h-[250px]">
                <div className="space-y-1">
                  {processResult.features.map((f) => (
                    <div
                      key={f.featureId}
                      className="hover:bg-fill-4 rounded-control-sm text-body flex items-center justify-between px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        {f.countryMatch ? (
                          <Check className="text-green h-3.5 w-3.5" />
                        ) : (
                          <X className="text-yellow h-3.5 w-3.5" />
                        )}
                        <span className="font-medium">{f.displayName}</span>
                      </div>
                      <div className="text-label-secondary text-footnote flex items-center gap-3">
                        {f.countryMatch && (
                          <Badge variant="default">
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
              <details className="text-label-secondary text-footnote">
                <summary className="hover:text-label cursor-pointer">
                  Processing log ({processResult.log.length} entries)
                </summary>
                <pre className="bg-fill-3 rounded-control-sm mt-2 max-h-32 overflow-auto p-2">
                  {processResult.log.join("\n")}
                </pre>
              </details>
            </>
          )}

          {/* Commit error */}
          {commitMutation.isError && (
            <div className="border-destructive/30 rounded-control border p-4">
              <div className="text-destructive text-body flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {commitMutation.error.message}
              </div>
            </div>
          )}
        </div>

        <SheetFooter>
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
            <Button onClick={handleCommit} disabled={isCommitting}>
              {isCommitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Committing...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Commit to map
                </>
              )}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
