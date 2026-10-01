import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { WikiNarratorPlayer } from "~/components/halo/plugins/wiki/components/WikiNarratorPlayer";
import { narratorEngineLabel } from "~/components/halo/plugins/wiki/types";
import { api } from "~/trpc/react";

jest.mock("~/components/audio/player", () => ({
  AudioPlayer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AudioPlayerControlBar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AudioPlayerButton: ({
    children,
    onClick,
    disabled,
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));
jest.mock("~/components/audio/elements/transport", () => ({ Transport: () => null }));
jest.mock("~/components/audio/elements/fader", () => ({ Fader: () => null }));
jest.mock("~/lib/audio-store", () => ({
  useAudioStore: Object.assign(() => ({}), {
    setState: jest.fn(),
    getState: () => ({
      togglePlay: jest.fn(),
      seek: jest.fn(),
      setVolume: jest.fn(),
      setPlaybackRate: jest.fn(),
    }),
  }),
}));

const speechConfigQuery = api.onoma.getSpeechConfig.useQuery as jest.Mock;
const voicesQuery = api.onoma.getKokoroVoices.useQuery as jest.Mock;

const actions = {
  play: jest.fn(),
  pause: jest.fn(),
  skipNext: jest.fn(),
  skipPrev: jest.fn(),
  setVoice: jest.fn(),
  setSpeed: jest.fn(),
  setVolume: jest.fn(),
  jumpToBlock: jest.fn(),
  jumpToSection: jest.fn(),
};
const state = (engine?: "kokoro" | "browser", extra: object = {}) => ({
  isPlaying: false,
  activeBlockIndex: 0,
  totalBlocks: 4,
  activeText: "",
  activeSectionTitle: "Overview",
  speed: 1,
  voice: "",
  volume: 0.2,
  ...(engine ? { engine } : {}),
  ...extra,
});

const player = (narratorState: object | null) =>
  render(<WikiNarratorPlayer narratorState={narratorState} narratorActions={actions} />);

beforeEach(() => {
  jest.clearAllMocks();
  speechConfigQuery.mockReturnValue({ data: undefined });
  voicesQuery.mockReturnValue({ data: undefined });
});

describe("narratorEngineLabel", () => {
  it("calls the browser's voice what it is", () => {
    expect(narratorEngineLabel("browser")).toBe("Read aloud (browser voice)");
    expect(narratorEngineLabel("browser", "Female US - Soft")).toBe("Read aloud (browser voice)");
  });

  it("names Kokoro, and the chosen voice when there is one", () => {
    expect(narratorEngineLabel("kokoro")).toBe("Natural voice (Kokoro)");
    expect(narratorEngineLabel("kokoro", "Female US - Soft")).toBe(
      "Natural voice (Kokoro) · Female US - Soft"
    );
  });
});

describe("WikiNarratorPlayer says which voice reads (plan 416, D16)", () => {
  it("labels the browser voice, and offers no Kokoro voice picker, when the narrator reports it", () => {
    player(state("browser"));

    expect(screen.getByTestId("narrator-engine")).toHaveTextContent("Read aloud (browser voice)");
    expect(screen.queryByTitle(/^Voice:/)).not.toBeInTheDocument();
  });

  it("labels the natural voice, with the picker, when the narrator reports it", () => {
    player(state("kokoro", { voice: "bf_emma" }));

    expect(screen.getByTestId("narrator-engine")).toHaveTextContent(
      "Natural voice (Kokoro) · Female UK - Noble"
    );
    expect(screen.getByTitle(/^Voice:/)).toBeInTheDocument();
  });

  it("before the first play, says what the settings say will read", () => {
    speechConfigQuery.mockReturnValue({ data: { kokoro: { enabled: false } } });
    const { unmount } = player(state());
    expect(screen.getByTestId("narrator-engine")).toHaveTextContent("Read aloud (browser voice)");
    unmount();

    speechConfigQuery.mockReturnValue({ data: { kokoro: { enabled: true } } });
    player(state());
    expect(screen.getByTestId("narrator-engine")).toHaveTextContent("Natural voice (Kokoro)");
  });

  it("claims nothing until it knows", () => {
    player(state());

    expect(screen.queryByTestId("narrator-engine")).not.toBeInTheDocument();
  });

  it("reads the speech config only while it has a narrator to show, and the voice list only for Kokoro", () => {
    player(state("browser"));
    expect(speechConfigQuery).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ enabled: true })
    );
    expect(voicesQuery).toHaveBeenLastCalledWith(
      undefined,
      expect.objectContaining({ enabled: false })
    );

    jest.clearAllMocks();
    speechConfigQuery.mockReturnValue({ data: undefined });
    voicesQuery.mockReturnValue({ data: undefined });
    player(state("kokoro"));
    expect(voicesQuery).toHaveBeenLastCalledWith(
      undefined,
      expect.objectContaining({ enabled: true })
    );

    jest.clearAllMocks();
    speechConfigQuery.mockReturnValue({ data: undefined });
    voicesQuery.mockReturnValue({ data: undefined });
    player(state("browser", { totalBlocks: 0 }));
    expect(speechConfigQuery).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ enabled: false })
    );
  });
});
