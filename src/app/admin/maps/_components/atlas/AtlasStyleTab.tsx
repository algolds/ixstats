"use client";

import Link from "next/link";
import { Expand } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { StyleEditorFrame } from "../../style-editor/_components/StyleEditorFrame";

const FRAME_HEIGHT = 720;

/** The map style editor at a fixed height, with a link to it full screen. */
export function AtlasStyleTab() {
  return (
    <div className="flex flex-col gap-3">
      <Button asChild variant="outline" size="sm" className="self-end">
        <Link href="/admin/maps/style-editor">
          <Expand />
          Open full screen
        </Link>
      </Button>
      <div className="border-separator rounded-card overflow-hidden border">
        <StyleEditorFrame height={FRAME_HEIGHT} />
      </div>
    </div>
  );
}
