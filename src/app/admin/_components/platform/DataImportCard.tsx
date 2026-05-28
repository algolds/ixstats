"use client";

import { Database, AlertCircle, CheckCircle2, Info } from "lucide-react";
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
    <Card className="glass-surface border-border/40">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-bold">
          <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-1.5 text-cyan-500">
            <Database className="h-4 w-4" />
          </div>
          Country Data Import
        </CardTitle>
        <CardDescription className="text-xs">
          Import roster data from Excel with preview and change tracking
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="text-foreground text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Upload Roster File
            </p>
            <FileUpload
              onFileSelect={onFileSelect}
              isUploading={isUploading}
              isAnalyzing={isAnalyzing}
            />

            {analyzeError && (
              <Alert variant="destructive" className="py-2.5">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Error analyzing file: {analyzeError}
                </AlertDescription>
              </Alert>
            )}

            {importError && (
              <Alert variant="destructive" className="py-2.5">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Error importing file: {importError}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-foreground text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Import Guidelines
            </p>
            <div className="border-border/20 bg-card/10 rounded-lg border p-4">
              <ul className="text-muted-foreground space-y-2.5 text-xs">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-500" />
                  <span>
                    Supports Excel (<code>.xlsx</code>, <code>.xls</code>) formats only.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-500" />
                  <span>
                    Shows a visual delta preview of all changed records before confirming.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-500" />
                  <span>Option to update existing country records or skip them.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-500" />
                  <span>Storyteller event modifiers and history are always preserved.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-500" />
                  <span>New countries are automatically initialized and added.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-400" />
                  <span>
                    Required fields: <strong>Country</strong>, <strong>Population</strong>,{" "}
                    <strong>GDP PC</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-400" />
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
