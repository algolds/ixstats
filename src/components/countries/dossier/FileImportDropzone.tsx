"use client";

import React, { useState, useCallback } from "react";
import { Upload, FileText, Check, AlertCircle, Sparkles, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { FacetCard } from "~/components/ui/facet-container";
import { cn } from "~/lib/utils";

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
    <FacetCard
      depth={1}
      interactive="none"
      className="overflow-hidden rounded-xl border border-white/10 bg-card/30 p-6 backdrop-blur-md"
    >
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-blue-400" />
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-foreground">
            Import Document to Dossier
          </h3>
        </div>
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel} className="h-7 w-7 p-0">
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
            "mt-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-all",
            isDragging
              ? "border-blue-500 bg-blue-500/10 scale-[0.99]"
              : "border-white/15 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04]"
          )}
        >
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 text-blue-400">
            <FileText className="h-6 w-6" />
          </div>
          <p className="text-sm font-bold text-foreground mb-1">
            Drag & drop Markdown or Text file
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            Supports .md, .txt, .json files (auto-parses headings into sections)
          </p>
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".md,.txt,.json,.markdown"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button size="sm" variant="outline" className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 pointer-events-none">
              Browse Files
            </Button>
          </label>
          {error && (
            <div className="mt-4 flex items-center gap-1.5 text-xs text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Parsed <strong className="text-foreground">{parsedSections.length} section(s)</strong> from{" "}
              <code className="text-blue-400">{fileName}</code>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setParsedSections([]);
                setFileName(null);
              }}
              className="h-6 text-[10px]"
            >
              Choose different file
            </Button>
          </div>

          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {parsedSections.map((sec, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs"
              >
                <div className="flex items-center justify-between font-bold text-foreground mb-1">
                  <span>{sec.title}</span>
                  <select
                    value={sec.classification}
                    onChange={(e) => {
                      const val = e.target.value as "PUBLIC" | "ALLIANCE" | "PRIVATE";
                      setParsedSections((prev) =>
                        prev.map((s, i) => (i === idx ? { ...s, classification: val } : s))
                      );
                    }}
                    className="rounded bg-black/40 px-2 py-0.5 text-[10px] text-muted-foreground border border-white/10"
                  >
                    <option value="PUBLIC">PUBLIC</option>
                    <option value="ALLIANCE">ALLIANCE</option>
                    <option value="PRIVATE">PRIVATE</option>
                  </select>
                </div>
                <p className="line-clamp-2 text-muted-foreground text-[11px] font-mono">
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
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => onImportSections(parsedSections)}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold gap-1.5"
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
