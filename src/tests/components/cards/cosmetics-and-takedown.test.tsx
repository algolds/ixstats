import { fireEvent, render, screen } from "@testing-library/react";
import type { ISourceOptions } from "@tsparticles/engine";

let mockReduceMotion = false;
let capturedOptions: ISourceOptions | undefined;

jest.mock("~/components/providers/FacetMotionConfig", () => ({
  useFacetReducedMotion: () => mockReduceMotion,
}));

jest.mock("@tsparticles/slim", () => ({
  loadSlim: jest.fn(() => Promise.resolve()),
}));

jest.mock("@tsparticles/react", () => ({
  __esModule: true,
  ParticlesProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="particles-provider">{children}</div>
  ),
  default: ({ id, options }: { id: string; options?: ISourceOptions }) => {
    capturedOptions = options;
    return <div data-testid="particles-canvas" id={id} />;
  },
}));

jest.mock("~/trpc/react", () => ({
  api: {
    nsImport: {
      getVerificationUrl: {
        useQuery: () => ({ data: { url: "https://www.nationstates.net/page=verify_login" } }),
      },
      requestSelfServiceTakedown: {
        useMutation: () => ({
          mutate: jest.fn(),
          reset: jest.fn(),
          isPending: false,
          data: undefined,
          error: null,
        }),
      },
    },
  },
}));

import { CosmeticParticlesCanvas } from "~/components/vault/CosmeticParticlesCanvas";
import { AvatarGlow } from "~/components/vault/AvatarGlow";
import { NeonFrameOverlay } from "~/components/vault/NeonFrameOverlay";
import { CardTakedownVerificationModal } from "~/components/cards/display/CardTakedownVerificationModal";

beforeEach(() => {
  mockReduceMotion = false;
  capturedOptions = undefined;
  document.documentElement.style.removeProperty("--color-cyan");
});

describe("CosmeticParticlesCanvas and shared cosmetics reduced-motion stillness", () => {
  it("returns null immediately under Reduce Motion and resolves semantic CSS tokens when active", () => {
    mockReduceMotion = true;
    const { container, rerender } = render(
      <CosmeticParticlesCanvas style="winter" containerType="frame" />
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId("particles-canvas")).toBeNull();

    document.documentElement.style.setProperty("--color-cyan", "rgb(14, 165, 233)");
    mockReduceMotion = false;
    rerender(<CosmeticParticlesCanvas style="winter" containerType="frame" />);

    expect(screen.getByTestId("particles-canvas")).toBeInTheDocument();
    expect(capturedOptions?.particles?.color).toEqual({
      value: ["rgb(14, 165, 233)", "rgb(255, 255, 255)"],
    });
  });

  it("renders AvatarGlow and NeonFrameOverlay via card-art.css classes and gates particles under Reduce Motion", () => {
    mockReduceMotion = true;
    const { container } = render(
      <div>
        <AvatarGlow avatarGlow={{ enabled: true, style: "imperial" }}>
          <span>Avatar</span>
        </AvatarGlow>
        <NeonFrameOverlay neonFrame={{ enabled: true, style: "ruby" }} />
      </div>
    );

    const glow = container.querySelector(".cosmetic-avatar-glow");
    expect(glow).toHaveAttribute("data-glow-style", "imperial");
    expect(container.querySelector(".cosmetic-avatar-aura")).not.toBeNull();

    const frame = container.querySelector(".cosmetic-neon-frame");
    expect(frame).toHaveAttribute("data-frame-style", "ruby");
    expect(container.querySelector(".cosmetic-neon-shimmer")).toBeNull();
  });
});

describe("CardTakedownVerificationModal Facet overlay and form primitives", () => {
  it("uses native facet-overlay DialogContent, Label htmlFor bindings, and Input controls", () => {
    render(
      <CardTakedownVerificationModal
        isOpen
        onClose={jest.fn()}
        cardId="c1"
        cardTitle="Testlandia"
        nsCardId={42}
        season={3}
      />
    );

    const dialog = screen.getByRole("dialog", { name: "Content removal request" });
    expect(dialog.className).not.toContain("bg-surface");

    const nationInput = screen.getByLabelText(/Nation name/i);
    const tokenInput = screen.getByLabelText(/Verification token/i);
    expect(nationInput).toHaveValue("Testlandia");

    fireEvent.change(tokenInput, { target: { value: "abc-token-123" } });
    expect(screen.getByRole("button", { name: "Submit removal request" })).toBeEnabled();
  });
});
