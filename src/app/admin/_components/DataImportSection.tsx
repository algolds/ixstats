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
  importError
}: DataImportSectionProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8 border border-gray-200 dark:border-gray-700">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
        <Database className="h-5 w-5 mr-2" />
        Country Data Import
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-3">
            Import Roster Data with Preview
          </h3>
          <FileUpload 
            onFileSelect={onFileSelect} 
            isUploading={isUploading}
            isAnalyzing={isAnalyzing} 
          />
          
          {/* Import Status Messages */}
          {analyzeError && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
                <p className="text-sm text-red-800 dark:text-red-200">
                  Error analyzing file: {analyzeError}
                </p>
              </div>
            </div>
          )}
          
          {importError && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
                <p className="text-sm text-red-800 dark:text-red-200">
                  Error importing file: {importError}
                </p>
              </div>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-3">
            Import Guidelines
          </h3>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-2">
              <li>• Supports Excel (.xlsx, .xls) formats only</li>
              <li>• Upload shows a preview of changes before importing</li>
              <li>• You can choose to update existing countries or skip them</li>
              <li>• Historical data and DM inputs are always preserved</li>
              <li>• New countries are automatically added to the system</li>
              <li>• Statistics are recalculated after successful import</li>
              <li>• Required fields: Country, Population, GDP PC</li>
              <li>• Only tracks 13 core fields from roster data</li>
              <li>• CSV support has been completely removed</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}