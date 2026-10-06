/**
 * Plan 416 item 7 (D16): the narrator reads the speech config (Kokoro settings) when somebody presses
 * play, not for every reader; only a user the TTS route lets in gets Kokoro's natural voice; and the
 * player is told which voice is actually reading.
 */
import { act, renderHook } from "@testing-library/react";
import { useWikiNarrator } from "~/hooks/useWikiNarrator";

const mockFetchConfig = jest.fn();
const mockUseConfigQuery = jest.fn();
const mockSetNarratorState = jest.fn();
const mockRegisterActions = jest.fn();
let mockHasAccess = true;

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => utils,
    onoma: { getSpeechConfig: { useQuery: (...args: unknown[]) => mockUseConfigQuery(...args) } },
  },
}));
const utils = { onoma: { getSpeechConfig: { fetch: (...args: unknown[]) => mockFetchConfig(...args) } } };

const mediaActions = {
  playTrack: jest.fn(),
  registerPlaybackDelegate: jest.fn(),
  updatePlaybackState: jest.fn(),
};
jest.mock("~/components/media/MediaContext", () => ({ useIxMediaActions: () => mediaActions }));
jest.mock("~/hooks/usePermissions", () => ({ useHasNarratorAccess: () => mockHasAccess }));
const notify = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock("~/hooks/useNotify", () => ({ useNotify: () => notify }));
const wikiContext = {
  articleTitle: "Caphiria",
  tocEntries: [],
  activeSectionId: null,
  setNarratorState: (...args: unknown[]) => mockSetNarratorState(...args),
  registerNarratorActions: (...args: unknown[]) => mockRegisterActions(...args),
  setActiveSectionId: jest.fn(),
};
jest.mock("~/components/wiki-os/shared/WikiContext", () => ({ useWikiContext: () => wikiContext }));
jest.mock("~/hooks/narrator/narrator-dom-parser", () => ({
  extractArticleBlocks: () => [
    { id: "b0", text: "Caphiria is a nation.", type: "prose", sectionId: "s", element: document.createElement("p") },
    { id: "b1", text: "It lies in the north.", type: "prose", sectionId: "s", element: document.createElement("p") },
  ],
}));

const speak = jest.fn();
const cancel = jest.fn();

beforeAll(() => {
  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    value: { speak, cancel, pause: jest.fn() },
  });
  (globalThis as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = class {
    rate = 1;
    onend: (() => void) | null = null;
    constructor(public text: string) {}
  };
  Element.prototype.scrollIntoView = jest.fn();
  globalThis.URL.createObjectURL = jest.fn(() => "blob:clip");
  globalThis.URL.revokeObjectURL = jest.fn();
  (globalThis as unknown as { Audio: unknown }).Audio = class {
    playbackRate = 1;
    volume = 1;
    paused = false;
    duration = 1;
    currentTime = 0;
    ontimeupdate: (() => void) | null = null;
    onended: (() => void) | null = null;
    play = jest.fn().mockResolvedValue(undefined);
    pause = jest.fn();
  };
});

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockHasAccess = true;
  mockFetchConfig.mockResolvedValue({ kokoro: { enabled: false, voice: "af_heart" } });
  window.localStorage.clear();
  globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(["x"]) }) as typeof fetch;
});
afterEach(() => jest.useRealTimers());

async function mountWithBlocks() {
  const articleRef = { current: document.createElement("div") };
  const hook = renderHook(() => useWikiNarrator(articleRef));
  await act(async () => {
    jest.advanceTimersByTime(600); // the narrator builds its blocks shortly after the article mounts
  });
  return hook;
}

const press = async (hook: Awaited<ReturnType<typeof mountWithBlocks>>) => {
  await act(async () => {
    hook.result.current.play();
    await Promise.resolve();
    await Promise.resolve();
  });
};

const engines = (): unknown[] =>
  mockSetNarratorState.mock.calls.map(([state]) => state.engine).filter((engine) => engine !== undefined);

describe("useWikiNarrator reads the speech config when somebody plays", () => {
  it("makes no speech-config request for a reader who is only reading, with or without access", async () => {
    await mountWithBlocks();
    mockHasAccess = false;
    await mountWithBlocks();

    expect(mockFetchConfig).not.toHaveBeenCalled();
    expect(mockUseConfigQuery).not.toHaveBeenCalled();
  });

  it("reads it once the user presses play", async () => {
    const hook = await mountWithBlocks();
    expect(mockFetchConfig).not.toHaveBeenCalled();

    await press(hook);

    expect(mockFetchConfig).toHaveBeenCalledTimes(1);
    expect(mockFetchConfig).toHaveBeenCalledWith(undefined, { staleTime: 600000 });
  });

  it("never reads it, and never plays, for a user without narrator access", async () => {
    mockHasAccess = false;
    const hook = await mountWithBlocks();

    await press(hook);

    expect(hook.result.current.blocks).toEqual([]);
    expect(mockFetchConfig).not.toHaveBeenCalled();
    expect(speak).not.toHaveBeenCalled();
  });
});

describe("useWikiNarrator says which voice is reading", () => {
  it("reads with the browser voice, and says so, when the natural voice is switched off", async () => {
    mockFetchConfig.mockResolvedValue({ kokoro: { enabled: false, voice: "af_heart" } });
    const hook = await mountWithBlocks();

    await press(hook);

    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak.mock.calls[0]![0].text).toBe("Caphiria is a nation.");
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(engines()).toEqual(["browser"]);
  });

  it("reads with Kokoro's natural voice, and says so, when it is on", async () => {
    mockFetchConfig.mockResolvedValue({ kokoro: { enabled: true, voice: "bf_emma" } });
    const hook = await mountWithBlocks();

    await press(hook);

    const requested = (globalThis.fetch as jest.Mock).mock.calls.map(([url]) => String(url));
    expect(requested[0]).toContain("/api/onoma/tts?");
    expect(requested[0]).toContain("voice=bf_emma");
    expect(speak).not.toHaveBeenCalled();
    expect(engines()).toEqual(["kokoro"]);
  });

  it("falls back to the browser voice, and says so, when the natural voice fails", async () => {
    mockFetchConfig.mockResolvedValue({ kokoro: { enabled: true, voice: "af_heart" } });
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false });
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const hook = await mountWithBlocks();

    await press(hook);

    expect(speak).toHaveBeenCalledTimes(1);
    expect(engines()).toEqual(["kokoro", "browser"]);
    warn.mockRestore();
  });

  it("reads with the browser voice, and says so, when the config cannot be read", async () => {
    mockFetchConfig.mockRejectedValue(new Error("offline"));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const hook = await mountWithBlocks();

    await press(hook);

    expect(speak).toHaveBeenCalledTimes(1);
    expect(engines()).toEqual(["browser"]);
    warn.mockRestore();
  });
});
