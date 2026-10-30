"use client";

import { Plus } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { StashButton, WikiPageTools, type WikiPageToolsProps } from "./WikiPageTools";

interface WikiPageActionsProps {
  onNewPage: () => void;
  /** Present on pages that have page tools; omitted on the main page and tool routes. */
  pageTools?: WikiPageToolsProps;
}

/** Trailing actions for a wiki page: the stash button, the New page button and the page tools menu. */
export function WikiPageActions({ onNewPage, pageTools }: WikiPageActionsProps) {
  return (
    <>
      {pageTools?.stashable && (
        <StashButton
          title={pageTools.title}
          source={pageTools.source ?? "ixwiki"}
          isSignedIn={pageTools.isSignedIn}
        />
      )}
      <Button variant="secondary" size="sm" onClick={onNewPage}>
        <Plus className="size-4" />
        New page
      </Button>
      {pageTools && <WikiPageTools {...pageTools} />}
    </>
  );
}
