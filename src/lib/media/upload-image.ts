import { withBasePath } from "~/lib/base-path";

interface UploadImageResponse {
  success?: boolean;
  url?: string;
  error?: string;
  retryAfter?: number;
}

/** An upload the server (or the network path to it) rejected, with the HTTP status and any retry hint. */
export class UploadImageError extends Error {
  status: number;
  retryAfter?: number;

  constructor(message: string, status: number, retryAfter?: number) {
    super(message);
    this.name = "UploadImageError";
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

/**
 * Upload an image file through `/api/upload/image` (Clerk auth, rate limit,
 * PNG/JPG/GIF/WEBP/SVG only, 5MB max) and return its public URL.
 * Throws an `UploadImageError` with the route's error message when the upload is rejected.
 */
export async function uploadImageFile(
  file: File,
  opts?: { signal?: AbortSignal }
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(withBasePath("/api/upload/image"), {
    method: "POST",
    body: formData,
    signal: opts?.signal,
  });
  const result: UploadImageResponse = await response.json().catch(() => ({}));

  if (!response.ok || !result.success || !result.url) {
    throw new UploadImageError(
      result.error ?? "Upload failed",
      response.status,
      typeof result.retryAfter === "number" ? result.retryAfter : undefined
    );
  }
  return result.url;
}
