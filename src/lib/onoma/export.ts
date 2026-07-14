// src/lib/onoma/export.ts
// Onoma — Batch Export Utilities

interface ExportNameItem {
  name: string;
  ipa: string;
  syllables: number;
  perplexity: number;
  length: number;
}

/**
 * Escapes a cell value for CSV layout.
 */
function escapeCSVCell(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Trigger download of a Blob object in the browser.
 */
function triggerBlobDownload(blob: Blob, filename: string): void {
  if (typeof window === "undefined") return;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports generated names data to a CSV file.
 */
export function exportToCSV(names: ExportNameItem[], filename = "onoma-batch.csv"): void {
  const headers = ["Name", "IPA Pronunciation", "SyllablesCount", "NaturalnessScore", "CharLength"];
  const rows = names.map((item) => [
    item.name,
    item.ipa,
    item.syllables,
    item.perplexity,
    item.length,
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map(escapeCSVCell).join(","))
    .join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  triggerBlobDownload(blob, filename);
}

/**
 * Exports generated names data and parameters to a JSON file.
 */
export function exportToJSON(
  names: ExportNameItem[],
  metadata: Record<string, any>,
  filename = "onoma-batch.json"
): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    generator: "Onoma Lab Batch Generator",
    metadata,
    count: names.length,
    names: names.map((item) => ({
      name: item.name,
      ipa: item.ipa,
      syllables: item.syllables,
      naturalness: item.perplexity,
      length: item.length,
    })),
  };

  const jsonContent = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });
  triggerBlobDownload(blob, filename);
}
