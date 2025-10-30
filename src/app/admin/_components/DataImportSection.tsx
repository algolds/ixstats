// src/app/admin/_components/DataImportSection.tsx
"use client";

import { Database, AlertCircle } from "lucide-react";
import { FileUpload } from "./FileUpload";

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
  importError,
}: DataImportSectionProps) {
  return (
    <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-md dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-4 flex items-center text-lg font-semibold text-gray-900 dark:text-white">
        <Database className="mr-2 h-5 w-5" />
        Country Data Import
      </h2>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-md mb-3 font-medium text-gray-700 dark:text-gray-300">
            Import Roster Data with Preview
          </h3>
          <FileUpload
            onFileSelect={onFileSelect}
            isUploading={isUploading}
            isAnalyzing={isAnalyzing}
          />

          {/* Import Status Messages */}
          {analyzeError && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
              <div className="flex">
                <AlertCircle className="mr-2 h-5 w-5 text-red-400" />
                <p className="text-sm text-red-800 dark:text-red-200">
                  Error analyzing file: {analyzeError}
                </p>
              </div>
            </div>
          )}

          {importError && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
              <div className="flex">
                <AlertCircle className="mr-2 h-5 w-5 text-red-400" />
                <p className="text-sm text-red-800 dark:text-red-200">
                  Error importing file: {importError}
                </p>
              </div>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-md mb-3 font-medium text-gray-700 dark:text-gray-300">
            Import Guidelines
          </h3>
          <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-700">
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <li>• Supports Excel (.xlsx, .xls) formats only</li>
              <li>• Upload shows a preview of changes before importing</li>
              <li>• You can choose to update existing countries or skip them</li>
              <li>• Historical data and DM inputs are always preserved</li>
              <li>• New countries are automatically added to the system</li>
              <li>• Statistics are recalculated after successful import</li>
              <li>• Required fields: Country, Population, GDP PC</li>
              <li>• Only tracks 13 core fields from roster data</li>
              <li>• CSV support has been completely removed</li>
              <li>• Option to sync epoch time with imported data for accurate tracking</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
