// src/app/admin/_components/platform/DataImportCard.tsx
"use client";

import { Database, AlertCircle } from "lucide-react";
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
    <Card className="glass-card-parent border-cyan-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5 text-cyan-500" />
          Country Data Import
        </CardTitle>
        <CardDescription>
          Import roster data from Excel with preview and change tracking
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="text-foreground text-sm font-medium">Import Roster Data with Preview</p>
            <FileUpload
              onFileSelect={onFileSelect}
              isUploading={isUploading}
              isAnalyzing={isAnalyzing}
            />

            {analyzeError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Error analyzing file: {analyzeError}</AlertDescription>
              </Alert>
            )}

            {importError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Error importing file: {importError}</AlertDescription>
              </Alert>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-foreground text-sm font-medium">Import Guidelines</p>
            <div className="bg-muted/50 rounded-lg p-4">
              <ul className="text-muted-foreground space-y-1.5 text-xs">
                <li>· Supports Excel (.xlsx, .xls) formats only</li>
                <li>· Upload shows a preview of changes before importing</li>
                <li>· You can choose to update existing countries or skip them</li>
                <li>· Historical data and storyteller effects are always preserved</li>
                <li>· New countries are automatically added to the system</li>
                <li>· Statistics are recalculated after successful import</li>
                <li>· Required fields: Country, Population, GDP PC</li>
                <li>· Only tracks 13 core fields from roster data</li>
                <li>· Option to sync epoch time with imported data</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
