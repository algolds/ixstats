"use client";

import React, { useState, useCallback } from "react";
import {
  Upload,
  Page as FileText,
  Check,
  WarningCircle as AlertCircle,
  Xmark as X,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { FacetCard } from "~/components/ui/facet-container";
import { cn } from "~/lib/utils";
import { OptionSelect } from "~/components/maps/shared/OptionSelect";

export interface ParsedLoreSection {
  title: string;
  content: string;
  classification: "PUBLIC" | "ALLIANCE" | "PRIVATE";
}

interface FileImportDropzoneProps {
  onImportSections: (sections: ParsedLoreSection[]) => void;
  onCancel?: () => void;
}

export function FileImportDropzone({ onImportSections, onCancel }: FileImportDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [parsedSections, setParsedSections] = useState<ParsedLoreSection[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parseTextToSections = (text: string, defaultTitle: string): ParsedLoreSection[] => {
    const lines = text.split("\n");
    const sections: ParsedLoreSection[] = [];
    let currentTitle = defaultTitle;
    let currentLines: string[] = [];

    for (const line of lines) {
      if (line.match(/^#{1,3}\s+/)) {
        if (currentLines.length > 0 && currentLines.join("").trim().length > 0) {
          sections.push({
            title: currentTitle,
            content: currentLines.join("\n").trim(),
            classification: "PUBLIC",
          });
          currentLines = [];
        }
        currentTitle = line.replace(/^#{1,3}\s+/, "").trim();
      } else {
        currentLines.push(line);
      }
    }

    if (currentLines.length > 0 && currentLines.join("").trim().length > 0) {
      sections.push({
        title: currentTitle,
        content: currentLines.join("\n").trim(),
        classification: "PUBLIC",
      });
    }

    return sections.length > 0
      ? sections
      : [
          {
            title: defaultTitle,
            content: text.trim(),
            classification: "PUBLIC",
          },
        ];
  };

  const handleFileProcess = useCallback((file: File) => {
    setError(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) {
          setError("File appears to be empty");
          return;
        }

        const baseTitle = file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ");
        const sections = parseTextToSections(text, baseTitle);
        setParsedSections(sections);
      } catch (err) {
        console.error("Failed to parse file:", err);
        setError("Could not parse file content. Please upload a valid .md, .txt, or .json file.");
      }
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileProcess(e.dataTransfer.files[0]);
      }
    },
    [handleFileProcess]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileProcess(e.target.files[0]);
    }
  };

  return (
    <FacetCard className="rounded-card overflow-hidden p-6">
      <div className="border-separator flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-2">
          <Upload className="text-label-secondary h-4 w-4" />
          <h3 className="text-label text-headline">Import Document to Dossier</h3>
        </div>
        {onCancel && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancel}
            className="h-8 w-8"
            aria-label="Cancel import"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {parsedSections.length === 0 ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "rounded-row mt-4 flex flex-col items-center justify-center border-2 border-dashed p-8 transition-[background-color,border-color,transform] duration-150",
            isDragging
              ? "border-ring bg-fill-3 scale-[0.99]"
              : "border-separator bg-fill-3 hover:border-ring/40 hover:bg-fill-3"
          )}
        >
          <FileText className="text-label-secondary mb-3 h-6 w-6" />
          <p className="text-label text-headline mb-1">Drag & drop Markdown or Text file</p>
          <p className="text-label-secondary text-footnote mb-4">
            Supports .md, .txt, .json files (auto-parses headings into sections)
          </p>
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".md,.txt,.json,.markdown"
              onChange={handleFileChange}
              className="peer sr-only"
            />
            <Button
              size="sm"
              variant="outline"
              className="peer-focus-visible:ring-tint pointer-events-none peer-focus-visible:ring-2"
            >
              Browse Files
            </Button>
          </label>
          {error && (
            <div className="text-destructive text-footnote mt-4 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="text-label-secondary text-footnote flex items-center justify-between">
            <span>
              Parsed <strong className="text-label">{parsedSections.length} section(s)</strong> from{" "}
              <code className="text-label">{fileName}</code>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setParsedSections([]);
                setFileName(null);
              }}
              className="text-footnote h-6"
            >
              Choose different file
            </Button>
          </div>

          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {parsedSections.map((sec, idx) => (
              <div
                key={idx}
                className="border-separator bg-surface rounded-control text-footnote border p-3"
              >
                <div className="text-label mb-1 flex items-center justify-between font-semibold">
                  <span>{sec.title}</span>
                  <OptionSelect
                    aria-label={`Classification for ${sec.title}`}
                    value={sec.classification}
                    onValueChange={(v) => {
                      const val = v as "PUBLIC" | "ALLIANCE" | "PRIVATE";
                      setParsedSections((prev) =>
                        prev.map((s, i) => (i === idx ? { ...s, classification: val } : s))
                      );
                    }}
                    options={[
                      { value: "PUBLIC", label: "PUBLIC" },
                      { value: "ALLIANCE", label: "ALLIANCE" },
                      { value: "PRIVATE", label: "PRIVATE" },
                    ]}
                    size="sm"
                    className="w-full"
                  />
                </div>
                <p className="text-label-secondary text-footnote line-clamp-2 tabular-nums">
                  {sec.content}
                </p>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setParsedSections([])}
              className="text-footnote"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => onImportSections(parsedSections)}
              className="text-footnote gap-2"
            >
              <Check className="h-3.5 w-3.5" />
              Import {parsedSections.length} Section(s)
            </Button>
          </div>
        </div>
      )}
    </FacetCard>
  );
}
