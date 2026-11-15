import React from "react";
import { act, render, screen } from "@testing-library/react";
import { CommandPalette } from "~/components/halo";
import { Halo, HaloContainer, HaloProvider, SIZE_PRESETS } from "~/components/halo/HaloPrimitives";
import { NavTray } from "~/components/halo/views/NavTray";
import { REDUCED_MOTION_FADE, springSnappy } from "~/lib/design/motion";

let reducedMotion = true;

jest.mock("~/components/providers/FacetMotionConfig", () => ({
  useFacetReducedMotion: () => reducedMotion,
}));

jest.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("~/trpc/react", () => ({
  api: {
    countries: { getSelectList: { useQuery: () => ({ data: undefined }) } },
    wikios: { advancedSearch: { useQuery: () => ({ data: undefined }) } },
    notifications: { getUnreadCount: { useQuery: () => ({ data: { count: 0 } }) } },
  },
}));

jest.mock("~/context/auth-context", () => ({
  useUser: () => ({ user: null, isLoaded: true, isSignedIn: false }),
  useAuth: () => ({ signOut: jest.fn() }),
}));

jest.mock("~/context/theme-context", () => ({
  useTheme: () => ({ toggleTheme: jest.fn(), toggleCompactMode: jest.fn() }),
}));

jest.mock("~/hooks/useSoundSettings", () => ({ useSoundSettings: () => ({}) }));
jest.mock("~/hooks/useNotify", () => ({ useNotify: () => ({}) }));
jest.mock("~/hooks/usePermissions", () => ({ useCanOpenAdmin: () => false }));
jest.mock("~/hooks/useContextHour", () => ({ useContextHour: () => 9 }));
jest.mock("~/hooks/useMessageUnreadCount", () => ({
  useMessageUnreadCount: () => ({ totalUnread: 0 }),
}));
jest.mock("~/components/wiki-os/shared/WikiContext", () => ({
  useWikiContext: () => ({
    activeSectionId: null,
    tocEntries: [],
    narratorState: null,
    themeColors: null,
  }),
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

describe("Halo navigation activity", () => {
  it("keeps the compact island mounted with Search and announces loading status", async () => {
    reducedMotion = false;
    render(<CommandPalette />);
    await act(async () => {});

    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();

    act(() => {
      window.dispatchEvent(new Event("ixstats-nav-start"));
    });

    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading page…");

    act(() => {
      window.dispatchEvent(new Event("ixstats-nav-end"));
    });

    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
  });
});
