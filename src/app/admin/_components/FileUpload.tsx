"use client";
// src/app/admin/_components/FileUpload.tsx

import { Upload, SystemRestart as Loader2 } from "iconoir-react";

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
      className="border-border hover:border-border/80 rounded-lg border-2 border-dashed p-6 transition-colors"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="text-center">
        {isAnalyzing || isUploading ? (
          <Loader2 className="text-muted-foreground mx-auto h-12 w-12 animate-spin" />
        ) : (
          <Upload className="text-muted-foreground mx-auto h-12 w-12" />
        )}
        <div className="mt-4">
          <label htmlFor="file-upload" className="cursor-pointer">
            <span className="text-foreground mt-2 block text-sm font-medium">
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
            <div className="text-muted-foreground mt-2 text-xs">
              {isAnalyzing
                ? "Analyzing changes..."
                : isUploading
                  ? "Importing..."
                  : "Click to select file or drag and drop"}
            </div>
          </label>
        </div>
        <div className="text-muted-foreground mt-4 text-xs">
          <p>• Supports .xlsx / .xls formats only</p>
          <p>• Excel files should have headers in the first row</p>
          <p>• Required columns: Country, Population, GDP PC</p>
          <p>• Upload will show a preview of changes before importing</p>
        </div>
      </div>
    </div>
  );
}
