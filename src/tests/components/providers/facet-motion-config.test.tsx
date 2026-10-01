import React, { useContext } from "react";
import { act, render, screen } from "@testing-library/react";
import { describe, it, expect, afterEach } from "@jest/globals";
import { MotionConfigContext } from "motion/react";
import { FacetMotionConfig } from "~/components/providers/FacetMotionConfig";

function ReducedMotionProbe() {
  const { reducedMotion } = useContext(MotionConfigContext);
  return <span data-testid="reduced-motion">{reducedMotion}</span>;
}

function renderProbe() {
  return render(
    <FacetMotionConfig>
      <ReducedMotionProbe />
    </FacetMotionConfig>
  );
}

/** MutationObserver callbacks are microtasks. */
const flush = () => act(async () => Promise.resolve());

afterEach(() => {
  document.documentElement.removeAttribute("data-motion");
});

describe("FacetMotionConfig", () => {
  it('follows the OS ("user") when the in-app setting is off', () => {
    renderProbe();
    expect(screen.getByTestId("reduced-motion")).toHaveTextContent("user");
  });

  it('forces "always" when html[data-motion="reduced"] is set', () => {
    document.documentElement.setAttribute("data-motion", "reduced");
    renderProbe();
    expect(screen.getByTestId("reduced-motion")).toHaveTextContent("always");
  });

  it("switches live when the in-app setting changes", async () => {
    renderProbe();
    expect(screen.getByTestId("reduced-motion")).toHaveTextContent("user");

    document.documentElement.setAttribute("data-motion", "reduced");
    await flush();
    expect(screen.getByTestId("reduced-motion")).toHaveTextContent("always");

    document.documentElement.removeAttribute("data-motion");
    await flush();
    expect(screen.getByTestId("reduced-motion")).toHaveTextContent("user");
  });
});
