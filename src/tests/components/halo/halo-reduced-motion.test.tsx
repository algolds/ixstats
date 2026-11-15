import React from "react";
import { render } from "@testing-library/react";
import { Halo, HaloContainer, HaloProvider, SIZE_PRESETS } from "~/components/halo/HaloPrimitives";
import { NavTray } from "~/components/halo/views/NavTray";
import { REDUCED_MOTION_FADE, springSnappy } from "~/lib/design/motion";

let reducedMotion = true;

jest.mock("~/components/providers/FacetMotionConfig", () => ({
  useFacetReducedMotion: () => reducedMotion,
}));

jest.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

jest.mock("~/components/ui/pretext", () => ({
  PreText: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

type CapturedMotion = {
  id?: string;
  tag: string;
  layout?: unknown;
  initial?: unknown;
  animate?: unknown;
  exit?: unknown;
  transition?: unknown;
};

const captured: CapturedMotion[] = [];

jest.mock("motion/react", () => {
  const ReactActual = jest.requireActual<typeof import("react")>("react");
  const makeTag = (tag: "div" | "nav") =>
    ReactActual.forwardRef<HTMLElement, Record<string, unknown>>(
      (
        {
          children,
          layout,
          initial,
          animate,
          exit,
          transition,
          drag: _drag,
          dragConstraints: _dc,
          dragElastic: _de,
          dragMomentum: _dm,
          onDragEnd: _ode,
          ...rest
        },
        ref
      ) => {
        captured.push({
          id: typeof rest.id === "string" ? rest.id : undefined,
          tag,
          layout,
          initial,
          animate,
          exit,
          transition,
        });
        return ReactActual.createElement(tag, { ...rest, ref }, children as React.ReactNode);
      }
    );
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      div: makeTag("div"),
      nav: makeTag("nav"),
    },
  };
});

beforeEach(() => {
  captured.length = 0;
  reducedMotion = true;
});

describe("Halo under Reduce Motion", () => {
  it("sets { duration: 0 } on the island layout transition when reduced motion is active", () => {
    const { container } = render(
      <HaloProvider initialSize={SIZE_PRESETS.COMPACT_TALL}>
        <Halo id="island">
          <span>Hello</span>
        </Halo>
      </HaloProvider>
    );

    const islandEl = container.querySelector("#island");
    expect(islandEl).toHaveAttribute("data-reduced-motion", "true");

    const islandMotion = captured.find((c) => c.id === "island");
    expect(islandMotion?.layout).toBe(true);
    expect(islandMotion?.transition).toEqual({ duration: 0 });
  });

  it("uses springSnappy on the island when reduced motion is off", () => {
    reducedMotion = false;
    render(
      <HaloProvider initialSize={SIZE_PRESETS.COMPACT_TALL}>
        <Halo id="island">
          <span>Hello</span>
        </Halo>
      </HaloProvider>
    );

    const islandMotion = captured.find((c) => c.id === "island");
    expect(islandMotion?.transition).toEqual(springSnappy);
  });

  it("replaces HaloContainer transform entrance with an opacity cross-fade", () => {
    render(<HaloContainer>Panel</HaloContainer>);
    expect(captured[0]).toMatchObject({
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: REDUCED_MOTION_FADE },
      exit: { opacity: 0, transition: REDUCED_MOTION_FADE },
    });
  });

  it("drops item stagger delays in NavTray under reduced motion", () => {
    render(<NavTray isOpen onClose={jest.fn()} />);
    const itemMotions = captured.filter((c) => c.tag === "div");
    expect(itemMotions.length).toBeGreaterThan(0);
    for (const item of itemMotions) {
      expect(item.transition).toEqual(REDUCED_MOTION_FADE);
    }
  });
});
