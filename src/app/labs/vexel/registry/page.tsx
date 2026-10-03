"use client";

import Link from "next/link";
import { PageHeader } from "~/components/shell/PageHeader";
import { Button } from "~/components/ui/button";
import RegistryBrowser from "~/components/maps/vexel/registry/RegistryBrowser";

export default function VexelRegistryPage() {
  return (
    <div className="bg-grouped text-label min-h-screen p-8 font-sans">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          title="Heraldic registry"
          subtitle="Public coats of arms: sovereign, institutional and personal."
          actions={
            <>
              <Button asChild variant="outline" size="sm">
                <Link href="/labs/vexel/generate">Generator gallery</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/labs/vexel">Open studio</Link>
              </Button>
            </>
          }
        />

        <RegistryBrowser />
      </div>
    </div>
  );
}
