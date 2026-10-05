"use client";

import { Plus } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { WikiPageTools, type WikiPageToolsProps } from "./WikiPageTools";

interface WikiPageActionsProps {
  onNewPage: () => void;
  /** Present on pages that have page tools; omitted on the main page and tool routes. */
  pageTools?: WikiPageToolsProps;
}

/** Trailing actions for a wiki page: the New page button and the page tools menu. */
export function WikiPageActions({ onNewPage, pageTools }: WikiPageActionsProps) {
  return (
    <>
      <Button variant="secondary" size="sm" onClick={onNewPage}>
        <Plus className="size-4" />
        New page
      </Button>
      {pageTools && <WikiPageTools {...pageTools} />}
    </>
  );
}
