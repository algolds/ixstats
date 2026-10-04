import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "@jest/globals";
import { Card } from "~/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetTitle } from "~/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "~/components/ui/hover-card";
import { Select, SelectContent, SelectItem, SelectTrigger } from "~/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";

const classOf = (el: Element | null) => el?.getAttribute("class") ?? "";
const bySlot = (slot: string) => document.querySelector(`[data-slot="${slot}"]`);

describe("overlays paint the overlay layer", () => {
  it("Dialog", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>T</DialogTitle>
        </DialogContent>
      </Dialog>
    );
    const content = bySlot("dialog-content");
    expect(classOf(content)).toMatch(/\bfacet-overlay\b/);
    expect(classOf(content)).not.toMatch(/\bbg-surface-elevated\b/);
  });

  it("AlertDialog", () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>T</AlertDialogTitle>
          <AlertDialogDescription>D</AlertDialogDescription>
        </AlertDialogContent>
      </AlertDialog>
    );
    expect(classOf(bySlot("alert-dialog-content"))).toMatch(/\bfacet-overlay\b/);
  });

  it("Sheet", () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetTitle>T</SheetTitle>
        </SheetContent>
      </Sheet>
    );
    const sheet = screen.getByRole("dialog");
    expect(classOf(sheet)).toMatch(/\bfacet-overlay\b/);
    expect(classOf(sheet)).not.toMatch(/\bbg-surface-elevated\b/);
  });

  it("Popover", () => {
    render(
      <Popover open>
        <PopoverTrigger>t</PopoverTrigger>
        <PopoverContent>body</PopoverContent>
      </Popover>
    );
    const content = bySlot("popover-content");
    expect(classOf(content)).toMatch(/\bfacet-overlay\b/);
    expect(classOf(content)).not.toMatch(/\bshadow-floating\b/);
  });

  it("DropdownMenu", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>t</DropdownMenuTrigger>
        <DropdownMenuContent>body</DropdownMenuContent>
      </DropdownMenu>
    );
    const content = bySlot("dropdown-menu-content");
    expect(classOf(content)).toMatch(/\bfacet-overlay\b/);
    expect(classOf(content)).not.toMatch(/\bshadow-floating\b/);
  });

  it("HoverCard", () => {
    render(
      <HoverCard open>
        <HoverCardTrigger>t</HoverCardTrigger>
        <HoverCardContent>body</HoverCardContent>
      </HoverCard>
    );
    const content = bySlot("hover-card-content");
    expect(classOf(content)).toMatch(/\bfacet-overlay\b/);
    expect(classOf(content)).not.toMatch(/\bbg-surface-elevated\b/);
  });

  it("Select", () => {
    render(
      <Select open value="a">
        <SelectTrigger>t</SelectTrigger>
        <SelectContent>
          <SelectItem value="a">A</SelectItem>
        </SelectContent>
      </Select>
    );
    const content = bySlot("select-content");
    expect(classOf(content)).toMatch(/\bfacet-overlay\b/);
    expect(classOf(content)).not.toMatch(/\bshadow-floating\b/);
  });

  it("Tooltip", () => {
    render(
      <Tooltip open>
        <TooltipTrigger>t</TooltipTrigger>
        <TooltipContent>tip</TooltipContent>
      </Tooltip>
    );
    const content = bySlot("tooltip-content");
    expect(classOf(content)).toMatch(/\bfacet-overlay\b/);
    expect(classOf(content)).not.toMatch(/\bbg-surface-elevated\b/);
  });

  it("a Card inside an overlay inside a Card is a pane again", () => {
    render(
      <Card>
        <Dialog open>
          <DialogContent>
            <DialogTitle>T</DialogTitle>
            <Card data-testid="inner">x</Card>
          </DialogContent>
        </Dialog>
      </Card>
    );
    expect(screen.getByTestId("inner").getAttribute("data-variant")).toBe("pane");
  });
});
