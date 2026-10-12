/**
 * The map import wizard follows its jobs through `useMapImportJob`. A job that cannot be read is no longer polled, so
 * the wizard says so with a way to read it again, rather than waiting on "Loading the import" for good.
 */
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/hooks/useMapImportJob", () => ({
  ...jest.requireActual("~/hooks/useMapImportJob"),
  useMapImportJob: jest.fn(),
}));

import { RealmMapImportWizard } from "~/app/admin/maps/_components/map-import/RealmMapImportWizard";
import { useMapImportJob } from "~/hooks/useMapImportJob";

const job = jest.mocked(useMapImportJob);

type Read = ReturnType<typeof useMapImportJob>;
const read = (over: Partial<Pick<Read, "data" | "error">> & { refetch?: jest.Mock }) =>
  ({ data: undefined, error: null, refetch: jest.fn(), ...over }) as unknown as Read;

afterEach(() => jest.clearAllMocks());

describe("the import wizard following an analysis", () => {
  it("says the import could not be read, with Try again and Start again, when the first read failed", () => {
    const refetch = jest.fn();
    job.mockReturnValue(read({ error: { message: "Import not found" } as Read["error"], refetch }));
    render(<RealmMapImportWizard realmId="r1" initialJobId="j1" />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The import could not be read: Import not found"
    );
    expect(screen.queryByText("Loading the import…")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Start again" }));
    expect(screen.getByText(/A political map of/)).toBeInTheDocument();
  });

  it("still says it is loading while the first read is under way", () => {
    job.mockReturnValue(read({}));
    render(<RealmMapImportWizard realmId="r1" initialJobId="j1" />);
    expect(screen.getByText("Loading the import…")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the job, not the read error, when the job was read and a later read failed", () => {
    job.mockReturnValue(
      read({
        data: {
          id: "j1",
          status: "running",
          progress: 40,
          stage: "Tracing",
          error: null,
        } as Read["data"],
        error: { message: "Network down" } as Read["error"],
      })
    );
    render(<RealmMapImportWizard realmId="r1" initialJobId="j1" />);
    expect(screen.getByText(/Tracing/)).toBeInTheDocument();
    expect(screen.queryByText(/could not be read/)).toBeNull();
  });
});
