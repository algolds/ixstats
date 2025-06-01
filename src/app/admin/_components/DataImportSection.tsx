// src/app/admin/_components/DataImportSection.tsx
"use client";

import { Database, AlertCircle, Info } from "lucide-react";
import { FileUpload } from "./FileUpload"; // Assuming FileUpload is in the same directory
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";

interface DataImportSectionProps {
  onFileSelect: (file: File) => void;
  isUploading: boolean;
  isAnalyzing: boolean;
  analyzeError: string | null;
  importError: string | null;
}

export function DataImportSection({
  onFileSelect,
  isUploading,
  isAnalyzing,
  analyzeError,
  importError
}: DataImportSectionProps) {
  return (
    <Card className="mb-8 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
      <CardHeader>
        <CardTitle className="text-lg text-gray-900 dark:text-white flex items-center">
          <Database className="h-5 w-5 mr-2" />
          Country Data Import
        </CardTitle>
        <CardDescription className="text-gray-600 dark:text-gray-400">
          Upload Excel files to update or add country data.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3">
              Upload Roster File
            </h3>
            <FileUpload 
              onFileSelect={onFileSelect} 
              isUploading={isUploading}
              isAnalyzing={isAnalyzing} 
            />
            
            {analyzeError && (
              <Alert variant="destructive" className="mt-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <AlertTitle className="text-red-700 dark:text-red-300">Analysis Error</AlertTitle>
                <AlertDescription className="text-red-700 dark:text-red-300">
                  {analyzeError}
                </AlertDescription>
              </Alert>
            )}
            
            {importError && (
              <Alert variant="destructive" className="mt-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <AlertTitle className="text-red-700 dark:text-red-300">Import Error</AlertTitle>
                <AlertDescription className="text-red-700 dark:text-red-300">
                  {importError}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div>
            <h3 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3">
              Import Guidelines
            </h3>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border dark:border-gray-600">
              <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1.5">
                <li><Info className="inline h-4 w-4 mr-1.5 text-blue-500" />Supports Excel (.xlsx, .xls) formats.</li>
                <li><Info className="inline h-4 w-4 mr-1.5 text-blue-500" />Upload shows a preview of changes.</li>
                <li><Info className="inline h-4 w-4 mr-1.5 text-blue-500" />Choose to update or skip existing countries.</li>
                <li><Info className="inline h-4 w-4 mr-1.5 text-blue-500" />Historical data & DM inputs are preserved.</li>
                <li><Info className="inline h-4 w-4 mr-1.5 text-blue-500" />New countries are automatically added.</li>
                <li><Info className="inline h-4 w-4 mr-1.5 text-blue-500" />Stats are recalculated after import.</li>
                <li><Info className="inline h-4 w-4 mr-1.5 text-blue-500" />Required fields: Country, Population, GDP PC.</li>
                 <li><Info className="inline h-4 w-4 mr-1.5 text-blue-500" />Only 13 core fields from roster data are tracked.</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
