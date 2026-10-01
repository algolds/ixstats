"use client";
// src/app/(wiki-os)/util/upload/page.tsx
// WikiOS Special:Upload — upload a file (image or PDF) to the wiki: served from WikiOS at once, and sent on to MediaWiki.

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Lock, Upload, WarningTriangle } from "iconoir-react";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { assetUrl, withBasePath } from "~/lib/base-path";
import { MAX_UPLOAD_BYTES, UPLOAD_EXTENSIONS } from "~/lib/wiki-os/config";
import {
  describeWarnings,
  postUpload,
  UPLOAD_FIELD_LIMITS,
  UPLOAD_ROUTE,
  uploadSizeProblem,
  type UploadedFileInfo,
} from "~/lib/wiki-os/upload-api";

type Access = "checking" | "allowed" | "signed-out" | "denied";

/** What `GET /api/wiki/upload` says about the caller. */
interface UploadAccess {
  signedIn: boolean;
  canUpload: boolean;
}

const ACCEPT = UPLOAD_EXTENSIONS.map((extension) => `.${extension}`).join(",");
const LIMIT_MB = MAX_UPLOAD_BYTES / 1_000_000;

/** The category names of a comma-separated field. */
const categoriesOf = (text: string): string[] =>
  text
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

export default function WikiUploadPage() {
  const [access, setAccess] = useState<Access>("checking");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [filename, setFilename] = useState("");
  const [description, setDescription] = useState("");
  const [license, setLicense] = useState("");
  const [categories, setCategories] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** MediaWiki's warnings, as sentences: the uploader may go on anyway. */
  const [warnings, setWarnings] = useState<string[]>([]);
  const [done, setDone] = useState<UploadedFileInfo | null>(null);

  useEffect(() => {
    fetch(withBasePath(UPLOAD_ROUTE))
      .then(async (res) => {
        const body = (await res.json()) as UploadAccess;
        if (!res.ok) return setAccess("denied");
        setAccess(!body.signedIn ? "signed-out" : body.canUpload ? "allowed" : "denied");
      })
      .catch(() => setAccess("denied"));
    // Special:Upload?wpDestFile=Name (MediaWiki's link for a file that does not exist yet) names the destination.
    const given = new URLSearchParams(window.location.search).get("wpDestFile");
    if (given) setFilename(given.replace(/_/g, " "));
  }, []);

  useEffect(() => {
    if (!file?.type.startsWith("image/")) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pick(chosen: File | null) {
    setFile(chosen);
    setError(null);
    setWarnings([]);
    setDone(null);
    if (chosen && !filename.trim()) setFilename(chosen.name);
  }

  async function send(ignoreWarnings: boolean) {
    if (!file) return;
    const tooLarge = uploadSizeProblem(file);
    if (tooLarge) return setError(tooLarge);
    setBusy(true);
    setError(null);
    setWarnings([]);
    try {
      const result = await postUpload(file, {
        filename,
        description,
        license,
        categories: categoriesOf(categories),
        ignoreWarnings,
      });
      if (result.result === "Warning") return setWarnings(describeWarnings(result.warnings));
      setDone(result);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The upload failed.");
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(warnings.length > 0);
  }

  function reset() {
    setFile(null);
    setFilename("");
    setDescription("");
    setLicense("");
    setCategories("");
    setDone(null);
    setError(null);
    setWarnings([]);
  }

  return (
    <WikiOSLayout title="Upload file">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
        {access === "checking" && <p className="text-muted-foreground text-sm">Checking access…</p>}

        {(access === "signed-out" || access === "denied") && (
          <Alert>
            <Lock />
            <AlertTitle>
              {access === "signed-out" ? "Sign in to upload" : "You cannot upload files yet"}
            </AlertTitle>
            <AlertDescription>
              {access === "signed-out"
                ? "Uploading changes the wiki, so you have to be signed in."
                : "Uploading needs the upload right: link and verify your wiki account, or ask an administrator."}
            </AlertDescription>
          </Alert>
        )}

        {access === "allowed" && done && (
          <section className="border-border bg-card space-y-4 rounded-xl border p-5">
            <h2 className="text-foreground text-base font-semibold">
              {done.noChange
                ? "Nothing to upload"
                : done.replaced
                  ? "New version uploaded"
                  : "File uploaded"}
            </h2>
            <p className="text-muted-foreground text-sm">
              {done.noChange
                ? `"${done.filename}" already has exactly this file as its current version.`
                : `"${done.filename}" is on the wiki now. It is served from WikiOS right away and sent on to MediaWiki in the background.`}
            </p>
            {done.mime.startsWith("image/") && (
              <img
                src={assetUrl(done.url) ?? undefined}
                alt={done.filename}
                width={done.width ?? undefined}
                height={done.height ?? undefined}
                className="max-h-64 max-w-full rounded-lg border border-white/10 object-contain"
              />
            )}
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href={done.descriptionUrl}>View the file page</Link>
              </Button>
              <Button variant="outline" onClick={reset}>
                Upload another file
              </Button>
            </div>
          </section>
        )}

        {access === "allowed" && !done && (
          <>
            <p className="text-muted-foreground text-sm">
              Upload an image (
              {UPLOAD_EXTENSIONS.filter((extension) => extension !== "pdf").join(", ")}) or a PDF,
              up to {LIMIT_MB} MB. The file is checked by what it is, not by its name. Use it in a
              page as <code>[[File:Name.png]]</code>.
            </p>

            <form
              onSubmit={submit}
              className="border-border bg-card space-y-4 rounded-xl border p-5"
            >
              <div className="space-y-2">
                <Label htmlFor="upload-file">File</Label>
                <Input
                  id="upload-file"
                  type="file"
                  accept={ACCEPT}
                  onChange={(event) => pick(event.target.files?.[0] ?? null)}
                />
                {preview && (
                  <img
                    src={preview}
                    alt="Preview of the file"
                    className="max-h-48 max-w-full rounded-lg border border-white/10 object-contain"
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="upload-name">Name on the wiki</Label>
                <Input
                  id="upload-name"
                  value={filename}
                  maxLength={UPLOAD_FIELD_LIMITS.filename}
                  onChange={(event) => {
                    setFilename(event.target.value);
                    setWarnings([]);
                  }}
                  placeholder="Flag of Eurth.png"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="upload-description">Summary</Label>
                <Textarea
                  id="upload-description"
                  value={description}
                  maxLength={UPLOAD_FIELD_LIMITS.description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What the file shows, who made it, where it is used"
                />
                <p className="text-muted-foreground text-xs">
                  Up to {UPLOAD_FIELD_LIMITS.description} characters; edit the file&apos;s page
                  afterwards for more.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="upload-license">License</Label>
                <Input
                  id="upload-license"
                  value={license}
                  maxLength={UPLOAD_FIELD_LIMITS.license}
                  onChange={(event) => setLicense(event.target.value)}
                  placeholder="{{PD-self}}, or who made it and under which terms"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="upload-categories">Categories</Label>
                <Input
                  id="upload-categories"
                  value={categories}
                  onChange={(event) => setCategories(event.target.value)}
                  placeholder="Flags, Maps of Eurth (separated by commas)"
                />
              </div>

              {warnings.length > 0 && (
                <Alert>
                  <WarningTriangle />
                  <AlertTitle>Check before uploading</AlertTitle>
                  <AlertDescription>
                    {warnings.map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                  </AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert variant="destructive">
                  <WarningTriangle />
                  <AlertTitle>Upload failed</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end">
                <Button type="submit" disabled={busy || !file || !filename.trim()}>
                  <Upload />
                  {busy ? "Uploading…" : warnings.length > 0 ? "Upload anyway" : "Upload"}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </WikiOSLayout>
  );
}
