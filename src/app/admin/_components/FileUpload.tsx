// src/app/admin/_components/FileUpload.tsx
"use client";

import { Upload } from "lucide-react";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isUploading: boolean;
  isAnalyzing: boolean;
}

export function FileUpload({ onFileSelect, isUploading, isAnalyzing }: FileUploadProps) {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    
    if (event.dataTransfer.files?.length > 0) {
      const file = event.dataTransfer.files[0];
      if (file) {
        onFileSelect(file);
      }
    }
  };

  return (
    <div 
      className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="text-center">
        <Upload className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
        <div className="mt-4">
          <label htmlFor="file-upload" className="cursor-pointer">
            <span className="mt-2 block text-sm font-medium text-gray-900 dark:text-white">
              Upload Excel roster file
            </span>
            <input
              id="file-upload"
              name="file-upload"
              type="file"
              accept=".xlsx,.xls"
              className="sr-only"
              onChange={handleFileChange}
              disabled={isUploading || isAnalyzing}
            />
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {isAnalyzing ? "Analyzing changes..." : isUploading ? "Importing..." : "Click to select file or drag and drop"}
            </div>
          </label>
        </div>
        <div className="mt-4 text-xs text-gray-400 dark:text-gray-500">
          <p>• Supports .xlsx / .xls formats only</p>
          <p>• Excel files should have headers in the first row</p>
          <p>• Required columns: Country, Population, GDP PC</p>
          <p>• Upload will show a preview of changes before importing</p>
        </div>
      </div>
    </div>
  );
}