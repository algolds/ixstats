/** Primitive behaviour: the hero material, press and lift physics, figures in the body face, CutoutCard and the flag watermark. */
import "fs";
import "path";
import "react";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  CutoutCard,
  CutoutCardAction,
  CutoutCardContent
} from "~/components/ui/cutout-card";
const classOf = (el: Element) => el.getAttribute("class") ?? "";
describe("CutoutCard", () => {
  it("is keyboard accessible when pressable and lifts/presses", () => {
    const onClick = jest.fn();
    render(
      <CutoutCard onClick={onClick} aria-label="Open vault">
        <CutoutCardContent>Vault</CutoutCardContent>
      </CutoutCard>
    );
    const card = screen.getByRole("button", { name: "Open vault" });
    expect(card).toHaveAttribute("tabindex", "0");
    expect(classOf(card)).toMatch(/\bfacet-lift\b/);
    expect(classOf(card)).toMatch(/\bfacet-press\b/);
    expect(classOf(card)).toContain("focus-visible:outline-tint");
    fireEvent.keyDown(card, { key: "Enter" });
    fireEvent.keyDown(card, { key: " " });
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("focus inside reveals hover-only actions (keyboard users reach them)", () => {
    render(
      <CutoutCard data-testid="cut">
        <button type="button">Inner</button>
        <CutoutCardAction data-testid="action">Act</CutoutCardAction>
      </CutoutCard>
    );
    expect(screen.getByTestId("cut")).toHaveAttribute("data-state", "idle");
    fireEvent.focus(screen.getByRole("button", { name: "Inner" }));
    expect(screen.getByTestId("cut")).toHaveAttribute("data-state", "hovered");
  });
});
