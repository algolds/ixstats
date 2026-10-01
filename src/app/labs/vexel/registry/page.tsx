"use client";

import Link from "next/link";
import RegistryBrowser from "~/components/maps/vexel/registry/RegistryBrowser";

export default function VexelRegistryPage() {
  return (
    <div className="bg-grouped text-label min-h-screen p-8 font-sans">
      <div className="mx-auto max-w-6xl">
        <header className="border-separator mb-8 flex items-center justify-between border-b pb-6">
          <div>
            <h1 className="text-large-title text-label">🛡️ Heraldic Registry</h1>
            <p className="text-body text-label-secondary mt-1">
              Rolls of the public sovereign, institutional, and personal coats of arms
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/labs/vexel/generate"
              className="rounded-control border-separator text-body text-label-secondary hover:bg-fill-4 hover:text-label border px-4 py-2 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform]"
            >
              Generator Gallery
            </Link>
            <Link
              href="/labs/vexel"
              className="rounded-control bg-tint text-body text-on-tint hover:bg-tint-hover px-4 py-2 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform]"
            >
              Open Studio
            </Link>
          </div>
        </header>

        <RegistryBrowser />
      </div>
    </div>
  );
}
