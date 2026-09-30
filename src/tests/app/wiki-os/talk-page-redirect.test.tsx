import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import TalkPageRedirect from "~/app/(wiki-os)/wiki/[slug]/talk/page";

const mockReplace = jest.fn();
const mockRouter = { replace: mockReplace, push: jest.fn() };
let mockSlug = "Foo_bar";

jest.mock("next/navigation", () => ({
  useParams: () => ({ slug: mockSlug }),
  useRouter: () => mockRouter,
}));
jest.mock("~/components/wiki-os/shared/WikiOSLayout", () => ({
  WikiOSLayout: ({ children, title }: { children: ReactNode; title?: string }) => (
    <div data-title={title}>{children}</div>
  ),
}));

describe("/wiki/[slug]/talk (plan 403)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("redirects to the canonical article with the margin open", () => {
    mockSlug = "foo_bar";
    render(<TalkPageRedirect />);
    expect(mockReplace).toHaveBeenCalledWith("/wiki/Foo_bar?margin=threads");
  });

  it("decodes the segment once: '100% Pure' is not encoded a second time", () => {
    mockSlug = "100%25_Pure";
    render(<TalkPageRedirect />);
    expect(mockReplace).toHaveBeenCalledWith("/wiki/100%25_Pure?margin=threads");
    expect(screen.getAllByText(/100% Pure/).length).toBeGreaterThan(0);
  });

  it("does not throw on a malformed escape, and does not redirect a title MediaWiki refuses", () => {
    mockSlug = "100% Pure";
    render(<TalkPageRedirect />);
    expect(mockReplace).toHaveBeenCalledWith("/wiki/100%25_Pure?margin=threads");

    mockReplace.mockClear();
    mockSlug = "a%5Bb";
    render(<TalkPageRedirect />);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
