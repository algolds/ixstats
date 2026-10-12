"use client";

import { Xmark } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { RealmMapImportWizard } from "../map-import/RealmMapImportWizard";

/** The realm map import wizard, with the admin picking the realm; `initialJobId` resumes an analysis started elsewhere. */
export function AtlasImportPanel({
  initialJobId,
  onClose,
}: {
  initialJobId: string | null;
  onClose: () => void;
}) {
  return (
    <Card content="input" padding="lg" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-title-3 text-label">Import a map</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <Xmark />
          Close
        </Button>
      </div>
      <RealmMapImportWizard initialJobId={initialJobId} />
    </Card>
  );
}
