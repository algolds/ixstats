/**
 * Where uploaded and server-rendered images live on disk, and the public path they are served at.
 * Used by the image upload route and by server-side renders (e.g. Vexel coat-of-arms images).
 */
import path from "path";

/** Public URL prefix for files in the uploads directory (base path is added on the frontend). */
export const UPLOADS_URL_PREFIX = "/images/uploads/";

/** UPLOAD_DIR when set, otherwise public/images/uploads under the app root. */
export function uploadsDir(): string {
  return (
    process.env.UPLOAD_DIR ||
    path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "images", "uploads")
  );
}
