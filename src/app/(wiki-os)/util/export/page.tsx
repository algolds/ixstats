"use client";
// src/app/(wiki-os)/util/export/page.tsx
// WikiOS Special:Export — download pages as a MediaWiki XML dump (export-0.11).

import { useState } from "react";
import { Download, Folder, WarningTriangle } from "iconoir-react";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { withBasePath } from "~/lib/base-path";
import { useWikiAuth } from "~/lib/wiki-os/use-wiki-auth";
import {
  exportQuery,
  MAX_EXPORT_URL_LENGTH,
  pageLimit,
  parseTitleList,
} from "~/lib/wiki-os/xml/export-request";
import { api } from "~/trpc/react";

/** Download `url` (an export response) as a file, or throw the route's error message. */
async function downloadExport(url: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Export failed (${res.status})`);
  }
  const blob = await res.blob();
  const fileName = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1];
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName ?? "export.xml";
  link.click();
  URL.revokeObjectURL(link.href);
}

export default function WikiExportPage() {
  const { isSignedIn } = useWikiAuth();
  const utils = api.useUtils();
  const [titlesText, setTitlesText] = useState("");
  const [category, setCategory] = useState("");
  const [history, setHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titles = parseTitleList(titlesText);
  const limit = pageLimit(history);
  const query = exportQuery(titles, history);
  const url = withBasePath(`/api/wiki/export?${query}`);
  const problem =
    titles.length > limit
      ? `Too many pages: at most ${limit} per export${history ? " with history" : ""}.`
      : url.length > MAX_EXPORT_URL_LENGTH
        ? "The page list is too long for one request: export it in smaller batches."
        : null;

  async function addCategoryPages() {
    const name = category.replace(/^category:/i, "").trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      const { members } = await utils.wikios.getCategoryMembers.fetch({
        category: name,
        limit: 500,
        type: "page",
      });
      setTitlesText(
        parseTitleList([titlesText, ...members.map((m) => m.title)].join("\n")).join("\n")
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not list that category.");
    } finally {
      setBusy(false);
    }
  }

  async function runExport() {
    setBusy(true);
    setError(null);
    try {
      await downloadExport(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <WikiOSLayout title="Export pages">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
        <p className="text-muted-foreground text-sm">
          Download pages as a MediaWiki XML dump (export-0.11) that MediaWiki&apos;s{" "}
          <code>Special:Import</code> and <code>importDump.php</code>, or another WikiOS, can read.
          Only published pages are exported.
        </p>

        <section className="border-border bg-card space-y-4 rounded-xl border p-5">
          <div className="space-y-2">
            <Label htmlFor="export-titles">Pages, one title per line</Label>
            <Textarea
              id="export-titles"
              rows={10}
              value={titlesText}
              onChange={(event) => setTitlesText(event.target.value)}
              placeholder={"Main Page\nTalk:Main Page"}
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="export-category">Add pages from a category</Label>
            <div className="flex gap-2">
              <Input
                id="export-category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="Category name"
              />
              <Button
                type="button"
                variant="outline"
                disabled={busy || category.trim() === ""}
                onClick={() => void addCategoryPages()}
              >
                <Folder />
                Add pages
              </Button>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="export-history"
              checked={history}
              disabled={!isSignedIn}
              onCheckedChange={(checked) => setHistory(checked === true)}
            />
            <Label htmlFor="export-history" className="flex-col items-start gap-1 leading-snug">
              Include the full history
              <span className="text-muted-foreground text-xs font-normal">
                {isSignedIn
                  ? `Every revision, up to ${pageLimit(true)} pages.`
                  : "Sign in to export page histories."}
              </span>
            </Label>
          </div>

          {(problem ?? error) && (
            <Alert variant="destructive">
              <WarningTriangle />
              <AlertTitle>Cannot export</AlertTitle>
              <AlertDescription>{problem ?? error}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground text-sm">
              {titles.length} of {limit} pages
            </span>
            <Button
              type="button"
              disabled={busy || titles.length === 0 || problem !== null}
              onClick={() => void runExport()}
            >
              <Download />
              {busy ? "Exporting…" : "Export as XML"}
            </Button>
          </div>
        </section>
      </div>
    </WikiOSLayout>
  );
}
