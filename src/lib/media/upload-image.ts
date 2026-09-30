import { withBasePath } from "~/lib/base-path";

interface UploadImageResponse {
  success?: boolean;
  url?: string;
  error?: string;
}

/**
 * Upload an image file through `/api/upload/image` (Clerk auth, rate limit,
 * PNG/JPG/GIF/WEBP/SVG only, 5MB max) and return its public URL.
 * Throws with the route's error message when the upload is rejected.
 */
export async function uploadImageFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(withBasePath("/api/upload/image"), {
    method: "POST",
    body: formData,
  });
  const result: UploadImageResponse = await response.json().catch(() => ({}));

  if (!response.ok || !result.success || !result.url) {
    throw new Error(result.error ?? "Upload failed");
  }
  return result.url;
}
