-- Image repository uploaded-asset records (plan 422). Applied by the owner at deploy, not automatically.
-- Additive and idempotent: one new table with its unique keys and indexes.

CREATE TABLE IF NOT EXISTS "uploaded_assets" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceRef" TEXT,
    "url" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "thumbUrl" TEXT,
    "title" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER NOT NULL DEFAULT 0,
    "height" INTEGER NOT NULL DEFAULT 0,
    "blurhash" TEXT,
    "uploaderClerkId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "uploaded_assets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uploaded_assets_url_key" ON "uploaded_assets"("url");
CREATE UNIQUE INDEX IF NOT EXISTS "uploaded_assets_source_sourceRef_key" ON "uploaded_assets"("source", "sourceRef");
CREATE INDEX IF NOT EXISTS "uploaded_assets_source_createdAt_idx" ON "uploaded_assets"("source", "createdAt");
CREATE INDEX IF NOT EXISTS "uploaded_assets_uploaderClerkId_createdAt_idx" ON "uploaded_assets"("uploaderClerkId", "createdAt");
