"use client";
// src/app/(wiki-os)/util/import/page.tsx
// WikiOS Special:Import — admin-only import of a MediaWiki XML dump (export-0.11).

import { useEffect, useState, type FormEvent } from "react";
import { Lock, Upload, WarningTriangle } from "iconoir-react";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { withBasePath } from "~/lib/base-path";

/** The import route's response (`ImportSummary` plus what it echoes back). */
interface ImportResult {
  dryRun: boolean;
  pages: number;
  pagesCreated: number;
  revisionsImported: number;
  revisionsSkipped: number;
  placeholdersFilled: number;
  uploadsSkipped: number;
  errors: Array<{ title: string; message: string }>;
  errorCount: number;
}

type Access = "checking" | "admin" | "denied";

const IMPORT_URL = withBasePath("/api/wiki/import");

export default function WikiImportPage() {
  const [access, setAccess] = useState<Access>("checking");
  const [file, setFile] = useState<File | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    fetch(IMPORT_URL)
      .then((res) => setAccess(res.ok ? "admin" : "denied"))
      .catch(() => setAccess("denied"));
  }, []);

  async function runImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("xml", file);
      form.append("dryRun", dryRun ? "1" : "0");
      const res = await fetch(IMPORT_URL, { method: "POST", body: form });
      const body = (await res.json()) as ImportResult | { error: string };
      if (!res.ok || "error" in body) {
        throw new Error("error" in body ? body.error : `Import failed (${res.status})`);
      }
      setResult(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <WikiOSLayout title="Import pages">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
        {access === "checking" && <p className="text-muted-foreground text-sm">Checking access…</p>}

        {access === "denied" && (
          <Alert>
            <Lock />
            <AlertTitle>Administrators only</AlertTitle>
            <AlertDescription>
              Importing a dump changes page history, so only wiki administrators can do it.
            </AlertDescription>
          </Alert>
        )}

        {access === "admin" && (
          <>
            <p className="text-muted-foreground text-sm">
              Import a MediaWiki XML dump (export-0.11, up to 100 MB). Revisions keep their
              MediaWiki ids, times and authors; re-importing a dump changes nothing, and a dump
              never replaces a page&apos;s newer text. For a whole wiki use{" "}
              <code>scripts/wikios-import-xml.ts</code>.
            </p>

            <form
              onSubmit={(event) => void runImport(event)}
              className="border-border bg-card space-y-4 rounded-xl border p-5"
            >
              <div className="space-y-2">
                <Label htmlFor="import-file">Dump file</Label>
                <Input
                  id="import-file"
                  type="file"
                  accept=".xml,application/xml,text/xml"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              </div>

              <div className="flex items-start gap-2">
                <Checkbox
                  id="import-dry-run"
                  checked={dryRun}
                  onCheckedChange={(checked) => setDryRun(checked === true)}
                />
                <Label htmlFor="import-dry-run" className="flex-col items-start gap-1 leading-snug">
                  Dry run
                  <span className="text-muted-foreground text-xs font-normal">
                    Report what would be imported without writing anything.
                  </span>
                </Label>
              </div>

              {error && (
                <Alert variant="destructive">
                  <WarningTriangle />
                  <AlertTitle>Import failed</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end">
                <Button type="submit" disabled={busy || !file}>
                  <Upload />
                  {busy ? "Importing…" : dryRun ? "Check the dump" : "Import"}
                </Button>
              </div>
            </form>

            {result && <ImportSummaryView result={result} />}
          </>
        )}
      </div>
    </WikiOSLayout>
  );
}

function ImportSummaryView({ result }: { result: ImportResult }) {
  const rows: Array<[string, number]> = [
    ["Pages read", result.pages],
    [result.dryRun ? "Pages that would be created" : "Pages created", result.pagesCreated],
    [
      result.dryRun ? "Revisions that would be imported" : "Revisions imported",
      result.revisionsImported,
    ],
    ["Revisions already present", result.revisionsSkipped],
    ["Empty revisions given their text", result.placeholdersFilled],
    ["Uploads skipped (files are imported separately)", result.uploadsSkipped],
  ];
  return (
    <section className="border-border bg-card space-y-4 rounded-xl border p-5">
      <h2 className="text-foreground text-base font-semibold">
        {result.dryRun ? "Dry run: nothing was written" : "Import finished"}
      </h2>
      <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-foreground text-right tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {result.errorCount > 0 && (
        <div className="space-y-2">
          <h3 className="text-destructive text-sm font-semibold">
            {result.errorCount} problem{result.errorCount === 1 ? "" : "s"}
            {result.errorCount > result.errors.length && ` (first ${result.errors.length} shown)`}
          </h3>
          <ul className="text-muted-foreground max-h-64 space-y-1 overflow-auto text-xs">
            {result.errors.map((item, index) => (
              <li key={`${item.title}-${index}`}>
                <span className="text-foreground font-medium">{item.title}</span>: {item.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
