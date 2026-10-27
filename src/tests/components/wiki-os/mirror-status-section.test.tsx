/**
 * Plan 2026-10-25 Task 3 (B3): the mirror outbox's warning on the WikiOS settings page. A stopped worker
 * (SKIP_MEDIAWIKI_SYNC) says so first; production without the private render engine names
 * WIKIOS_MEDIAWIKI_INTERNAL_URL and says the jobs wait, as does a WIKIOS_MEDIAWIKI_API on the public wiki; a missing
 * bot account comes last.
 */
import { render, screen } from "@testing-library/react";

const mutation = { mutate: jest.fn(), isPending: false };
let mockStatus: object = {};

jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({ wikios: { getMirrorStatus: { invalidate: jest.fn() } } }),
    wikios: {
      getMirrorStatus: { useQuery: () => ({ data: mockStatus, isLoading: false }) },
      requeueMirrorJob: { useMutation: () => mutation },
      discardMirrorJob: { useMutation: () => mutation },
      requeueDeadMirrorJobs: { useMutation: () => mutation },
      discardDeadMirrorJobs: { useMutation: () => mutation },
    },
  },
}));

import { MirrorStatusSection } from "~/app/admin/wikios-settings/MirrorStatusSection";

const status = (over: object) => ({
  paused: false,
  loopbackMissing: false,
  publicWriteUrl: false,
  botConfigured: true,
  counts: { pending: 3, running: 0, done: 0, dead: 0, discarded: 0 },
  oldestPendingSeconds: 60,
  uploadsWaiting: 0,
  dead: [],
  windowSaturated: false,
  windowSize: 1_000,
  ...over,
});

const LOOPBACK =
  "The mirror waits for WIKIOS_MEDIAWIKI_INTERNAL_URL, the private render engine: jobs accumulate and nothing is lost.";

const PUBLIC =
  "WIKIOS_MEDIAWIKI_API points at the public wiki or at IxStates itself: the mirror waits for a private write URL, jobs accumulate and nothing is lost.";

describe("the mirror outbox warning", () => {
  it("names WIKIOS_MEDIAWIKI_INTERNAL_URL when the loopback is missing", () => {
    mockStatus = status({ loopbackMissing: true });
    render(<MirrorStatusSection />);

    expect(screen.getByText(LOOPBACK)).toBeInTheDocument();
  });

  it("says WIKIOS_MEDIAWIKI_API points at the public wiki", () => {
    mockStatus = status({ publicWriteUrl: true });
    render(<MirrorStatusSection />);

    expect(screen.getByText(PUBLIC)).toBeInTheDocument();
  });

  it("names the public write URL before a missing bot account", () => {
    mockStatus = status({ publicWriteUrl: true, botConfigured: false });
    render(<MirrorStatusSection />);

    expect(screen.getByText(PUBLIC)).toBeInTheDocument();
    expect(screen.queryByText(/No mirror bot account/)).toBeNull();
  });

  it("names the loopback before a missing bot account", () => {
    mockStatus = status({ loopbackMissing: true, botConfigured: false });
    render(<MirrorStatusSection />);

    expect(screen.getByText(LOOPBACK)).toBeInTheDocument();
    expect(screen.queryByText(/No mirror bot account/)).toBeNull();
  });

  it("says the worker is stopped first: SKIP_MEDIAWIKI_SYNC keeps its own copy", () => {
    mockStatus = status({ paused: true, loopbackMissing: true });
    render(<MirrorStatusSection />);

    expect(
      screen.getByText(/The mirror worker is stopped \(SKIP_MEDIAWIKI_SYNC\)/)
    ).toBeInTheDocument();
    expect(screen.queryByText(LOOPBACK)).toBeNull();
  });

  it("shows no warning when the mirror can write", () => {
    mockStatus = status({});
    render(<MirrorStatusSection />);

    expect(screen.queryByText(LOOPBACK)).toBeNull();
    expect(screen.queryByText(/No mirror bot account/)).toBeNull();
  });
});
