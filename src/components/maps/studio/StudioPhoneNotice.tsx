"use client";

import Link from "next/link";
import { Button } from "~/components/ui/button";

/** What a phone gets instead of World Studio: nothing heavy, just the way back. */
export function StudioPhoneNotice() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-title-2">World Studio needs a wider screen</h1>
      <p className="text-label-secondary text-body max-w-sm">
        The parameter rail, the map and the inspector sit side by side. Open it on a larger screen.
      </p>
      <Button asChild>
        <Link href="/admin/maps">Back to Atlas</Link>
      </Button>
    </div>
  );
}
