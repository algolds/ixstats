// src/app/admin/_components/FileUpload.tsx
"use client";

import { Upload, Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button"; // For a more styled trigger if desired
import { cn } from "~/lib/utils";

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
    // Reset file input to allow selecting the same file again
    event.target.value = "";
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

  const isDisabled = isUploading || isAnalyzing;

  return (
    <div
      className={cn(
        "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
        isDisabled 
          ? "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 cursor-not-allowed" 
          : "border-gray-300 dark:border-gray-600 hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-gray-700/50 cursor-pointer"
      )}
      onDragOver={isDisabled ? undefined : handleDragOver}
      onDrop={isDisabled ? undefined : handleDrop}
      onClick={() => !isDisabled && document.getElementById("file-upload")?.click()} // Trigger click on div click
    >
      <input
        id="file-upload"
        name="file-upload"
        type="file"
        accept=".xlsx,.xls" // Ensure this matches your backend
        className="sr-only"
        onChange={handleFileChange}
        disabled={isDisabled}
      />
      {isDisabled ? (
        <Loader2 className="mx-auto h-10 w-10 text-gray-400 dark:text-gray-500 animate-spin" />
      ) : (
        <Upload className="mx-auto h-10 w-10 text-gray-400 dark:text-gray-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400" />
      )}
      <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        {isAnalyzing ? "Analyzing file..." : isUploading ? "Importing data..." : "Click or drag & drop Excel file"}
      </p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Supports .xlsx, .xls. Headers in first row.
      </p>
       <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Required: Country, Population, GDP PC.
      </p>
      {/* Example of using a styled button if you prefer a more explicit click target
          This button would also need to trigger the hidden file input.
      <Button variant="outline" size="sm" className="mt-4" disabled={isDisabled} onClick={(e) => { e.stopPropagation(); document.getElementById('file-upload')?.click(); }}>
        Select File
      </Button>
      */}
    </div>
  );
}
