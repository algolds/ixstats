import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import WikiOSEditPage from "~/app/(wiki-os)/wiki/[slug]/edit/page";

const mockReplace = jest.fn();
const mockEditor = jest.fn();
let mockSearch = "";

jest.mock("next/navigation", () => ({
  useParams: () => ({ slug: "Portal%3AEurth" }),
  useSearchParams: () => new URLSearchParams(mockSearch),
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}));
jest.mock("~/components/wiki-os/shared/WikiOSLayout", () => ({
  WikiOSLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
jest.mock("~/components/wiki-os/editor/WikiEditBridge", () => ({
  WikiEditBridge: (props: { title: string }) => {
    mockEditor(props);
    return <div>editor</div>;
  },
}));

describe("/wiki/[slug]/edit with ?source= (ruling E-l′)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearch = "";
  });

  it("another wiki's page is never edited here: back to its read view", () => {
    mockSearch = "source=iiwiki";
    render(<WikiOSEditPage />);
    expect(mockEditor).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith("/wiki/Portal%3AEurth?source=iiwiki");
  });

  it.each(["", "source=ixwiki", "source=bogus"])("%p opens the IxWiki editor", (search) => {
    mockSearch = search;
    render(<WikiOSEditPage />);
    expect(mockEditor).toHaveBeenCalledWith(expect.objectContaining({ title: "Portal:Eurth" }));
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
