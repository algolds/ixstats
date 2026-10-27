"use client";

import { Button } from "~/components/ui/button";
import { ArrowLeft, Component as Layers } from "iconoir-react";
import { StyleEditorFrame } from "./StyleEditorFrame";

export function StyleEditorRouter() {
  return (
    <div className="bg-surface text-label flex h-screen w-screen flex-col overflow-hidden">
      <header className="border-separator bg-surface flex h-12 items-center border-b px-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              window.location.href = "/admin/maps";
            }}
            title="Return to Atlas"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Exit editor</span>
          </Button>

          <div className="bg-surface-secondary h-4 w-px" />

          <div className="flex items-center gap-2">
            <Layers className="text-blue h-4.5 w-4" />
            <h1 className="text-headline">Style editor</h1>
          </div>
        </div>
      </header>
      <StyleEditorFrame className="flex-1" />
    </div>
  );
}
