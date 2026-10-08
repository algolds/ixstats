import { fireEvent, render, screen } from "@testing-library/react";

const status = jest.fn();
const mutate = jest.fn();
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({
      wikios: {
        getEditingStatus: { invalidate: jest.fn() },
        getMirrorStatus: { invalidate: jest.fn() },
      },
    }),
    wikios: {
      getEditingStatus: { useQuery: () => status() },
      setEditing: { useMutation: () => ({ mutate, isPending: false }) },
    },
  },
}));

import { EditingSection } from "~/app/admin/wikios-settings/EditingSection";

const base = { enabled: false, forcedByEnv: false, mirrorConfigured: true, missing: [] };

describe("EditingSection", () => {
  beforeEach(() => mutate.mockReset());

  it("asks for confirmation before turning editing on", () => {
    status.mockReturnValue({ data: base, isLoading: false });
    render(<EditingSection />);
    fireEvent.click(screen.getByRole("switch", { name: "WikiOS editing" }));
    expect(screen.getByText(/Anyone with wiki rights can edit in WikiOS/)).toBeInTheDocument();
    expect(
      screen.getByText(
        /Page protections set in MediaWiki before WikiOS started syncing are not enforced until the protections backfill \(cutover runbook steps 1 and 1b\) has run\./
      )
    ).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Turn on" }));
    expect(mutate).toHaveBeenCalledWith({ enabled: true });
  });

  it("explains the drain when turning off", () => {
    status.mockReturnValue({ data: { ...base, enabled: true }, isLoading: false });
    render(<EditingSection />);
    fireEvent.click(screen.getByRole("switch", { name: "WikiOS editing" }));
    expect(screen.getByText(/Edits already made keep copying to MediaWiki/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Turn off" }));
    expect(mutate).toHaveBeenCalledWith({ enabled: false });
  });

  it("is locked on when the environment forces it", () => {
    status.mockReturnValue({
      data: { ...base, enabled: true, forcedByEnv: true },
      isLoading: false,
    });
    render(<EditingSection />);
    expect(screen.getByRole("switch", { name: "WikiOS editing" })).toBeDisabled();
    expect(screen.getByText("Forced on by WIKIOS_V1_ENABLED")).toBeInTheDocument();
  });

  it("lists missing mirror settings and cannot be turned on", () => {
    status.mockReturnValue({
      data: { ...base, mirrorConfigured: false, missing: ["WIKIOS_MEDIAWIKI_BOT_TOKEN"] },
      isLoading: false,
    });
    render(<EditingSection />);
    expect(screen.getByRole("switch", { name: "WikiOS editing" })).toBeDisabled();
    expect(screen.getByText(/WIKIOS_MEDIAWIKI_BOT_TOKEN/)).toBeInTheDocument();
  });
});
