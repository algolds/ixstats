"use client";

import Link from "next/link";
import GalleryMode from "~/components/maps/vexel/GalleryMode";

export default function VexelGeneratePage() {
  return (
    <div className="bg-grouped text-label min-h-screen p-8">
      <div className="mx-auto max-w-6xl">
        <header className="border-separator mb-8 flex items-center justify-between border-b pb-6">
          <div>
            <h1 className="text-large-title text-label">🛡️ Vexel Gallery</h1>
            <p className="text-body text-label-secondary mt-1">
              Procedural armorial achievements generator
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/labs/vexel/registry"
              className="rounded-control border-separator text-body text-label-secondary hover:bg-fill-4 hover:text-label border px-4 py-2 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform]"
            >
              Public Registry
            </Link>
            <Link
              href="/labs/vexel"
              className="rounded-control bg-tint text-body text-on-tint hover:bg-tint-hover px-4 py-2 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform]"
            >
              Open Studio
            </Link>
          </div>
        </header>

        <GalleryMode />
      </div>
    </div>
  );
}
