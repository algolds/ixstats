"use client";

import Link from "next/link";
import { PageHeader } from "~/components/shell/PageHeader";
import { Button } from "~/components/ui/button";
import GalleryMode from "~/components/maps/vexel/GalleryMode";

export default function VexelGeneratePage() {
  return (
    <div className="bg-grouped text-label min-h-screen p-8">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          title="Vexel gallery"
          subtitle="Procedural armorial achievements generator."
          actions={
            <>
              <Button asChild variant="outline" size="sm">
                <Link href="/labs/vexel/registry">Public registry</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/labs/vexel">Open studio</Link>
              </Button>
            </>
          }
        />

        <GalleryMode />
      </div>
    </div>
  );
}
