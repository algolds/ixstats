import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { EntityHeader } from "~/components/ui/entity-header";
import { Signal } from "~/components/ui/signal";
import { Inspector } from "~/components/ui/inspector";
import { RevealStage } from "~/components/ui/reveal-stage";

const reveal = jest.fn();
jest.mock("~/lib/sound/cuelume", () => ({ soundCues: { reveal: () => reveal() }, soundEffects: {} }));

let wide = true;
jest.mock("~/hooks/useMediaQuery", () => ({ useMediaQuery: () => wide }));

describe("EntityHeader", () => {
  it("is an unboxed entity header with one h1", () => {
    render(<EntityHeader name="Caphiria" facts={<span>Republic</span>} />);
    const header = screen.getByRole("banner");
    expect(header).toHaveAttribute("data-content", "entity");
    expect(header.className).not.toMatch(/facet-pane/);
    expect(screen.getByRole("heading", { level: 1, name: "Caphiria" })).toHaveClass("text-large-title");
  });
});

describe("Signal", () => {
  it("is a status banner that dismisses", () => {
    const onDismiss = jest.fn();
    render(<Signal tone="warning" title="Budget deficit" onDismiss={onDismiss}>Spending exceeds revenue.</Signal>);
    const signal = screen.getByRole("status");
    expect(signal).toHaveAttribute("data-content", "signal");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it("uses role=alert for destructive and has no dismiss without onDismiss", () => {
    render(<Signal tone="destructive" title="Crisis" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("Inspector", () => {
  it("is a labelled aside on wide screens", () => {
    wide = true;
    render(<Inspector title="Contents" open={false} onOpenChange={() => {}}>toc</Inspector>);
    expect(screen.getByRole("complementary", { name: "Contents" })).toHaveTextContent("toc");
  });

  it("is a sheet below 1280px", () => {
    wide = false;
    render(<Inspector title="Contents" open onOpenChange={() => {}}>toc</Inspector>);
    expect(screen.getByRole("dialog")).toHaveTextContent("toc");
    expect(screen.queryByRole("complementary")).toBeNull();
  });
});

describe("RevealStage", () => {
  it("plays the reveal cue once and labels the dialog", () => {
    reveal.mockClear();
    render(<RevealStage open onOpenChange={() => {}} title="Reward claimed">+120</RevealStage>);
    expect(screen.getByRole("dialog", { name: "Reward claimed" })).toHaveAttribute("data-content", "reveal");
    expect(reveal).toHaveBeenCalledTimes(1);
  });
});
