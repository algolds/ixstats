"use client";

import {
  Database,
  WarningCircle as AlertCircle,
  CheckCircle as CheckCircle2,
  InfoCircle as Info,
} from "iconoir-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { FileUpload } from "../FileUpload";

interface DataImportCardProps {
  onFileSelect: (file: File) => void;
  isUploading: boolean;
  isAnalyzing: boolean;
  analyzeError: string | null;
  importError: string | null;
}

export function DataImportCard({
  onFileSelect,
  isUploading,
  isAnalyzing,
  analyzeError,
  importError,
}: DataImportCardProps) {
  return (
    <Card className="flex flex-col gap-6 py-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-headline flex items-center gap-2">
          <div className="rounded-control border-teal/20 bg-teal/10 text-teal border p-2">
            <Database className="h-4 w-4" />
          </div>
          Country data import
        </CardTitle>
        <CardDescription className="text-footnote">
          Import roster data from Excel with preview and change tracking
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="text-label text-label-secondary text-eyebrow">Upload roster file</p>
            <FileUpload
              onFileSelect={onFileSelect}
              isUploading={isUploading}
              isAnalyzing={isAnalyzing}
            />

            {analyzeError && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-footnote">
                  Error analyzing file: {analyzeError}
                </AlertDescription>
              </Alert>
            )}

            {importError && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-footnote">
                  Error importing file: {importError}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-label text-label-secondary text-eyebrow">Import guidelines</p>
            <div className="border-separator bg-surface rounded-control border p-4">
              <ul className="text-label-secondary text-footnote space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="text-teal mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Supports Excel (<code>.xlsx</code>, <code>.xls</code>) formats only.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="text-teal mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Shows a visual delta preview of all changed records before confirming.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="text-teal mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>Option to update existing country records or skip them.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="text-teal mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>Storyteller event modifiers and history are always preserved.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="text-teal mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>New countries are automatically initialized and added.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Info className="text-indigo mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Required fields: <strong>Country</strong>, <strong>Population</strong>,{" "}
                    <strong>GDP PC</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Info className="text-indigo mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>Only updates the 13 core tracking properties from the spreadsheet.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
