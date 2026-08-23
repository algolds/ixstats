"use client";

// src/app/labs/onoma/components/stash/ImportStashPanel.tsx
// Onoma Custom Studio Workshop — Import Stash Panel Component

import { useState } from "react";
import { Upload, SystemRestart as Loader2 } from "iconoir-react";
import { useNameBank } from "~/hooks/useNameBank";
import { guessRoleGenderFromFilename } from "~/lib/onoma/name-sets";

export function ImportStashPanel() {
  const bank = useNameBank();
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;

    setUploadStatus(`Importing ${files.length} file(s)...`);
    let created = 0;

    for (const file of files) {
      try {
        const text = await file.text();
        const words = text
          .split(/[\r\n,\s]+/)
          .map((w) => w.trim())
          .filter(Boolean);
        if (words.length === 0) continue;

        const title = file.name.replace(/\.[^.]+$/, "");
        const { role, gender } = guessRoleGenderFromFilename(file.name);

        await bank.saveEntry({
          type: "dictionary",
          title,
          values: words,
          role,
          gender,
        });
        created++;
      } catch (err) {
        console.error(`Failed to import ${file.name}:`, err);
      }
    }

    setUploadStatus(
      `Imported ${created} dictionary file(s). Tag them into a Name Set to edit roles.`
    );
    setTimeout(() => setUploadStatus(null), 5000);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {/* Upload .txt files (one dictionary per file) */}
        <label className="border-border/60 bg-background/50 hover:bg-background/80 text-foreground flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors select-none active:scale-95">
          <Upload className="h-3.5 w-3.5" />
          <span>Upload .txt</span>
          <input type="file" multiple accept=".txt" className="hidden" onChange={handleUpload} />
        </label>
      </div>

      {uploadStatus && (
        <div className="border-border/20 bg-secondary/15 flex items-center gap-2 rounded-xl border p-3 text-xs leading-normal">
          <Loader2 className="h-4 w-4 animate-spin text-onoma-primary" />
          <span>{uploadStatus}</span>
        </div>
      )}
    </div>
  );
}

export default ImportStashPanel;
