/**
 * The Facet data table every admin and MyCountry list uses: search narrows the rows, sortable headers are buttons
 * that report aria-sort, paging is a named nav that marks the current page, mobile cards are pressable from the
 * keyboard, and loading is announced as busy.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { FacetDataTable } from "~/components/ui/data-table/FacetDataTable";
import { FacetTablePagination } from "~/components/ui/data-table/FacetTablePagination";
import type { FacetColumn } from "~/components/ui/data-table/types";

interface Person {
  id: string;
  name: string;
  role: string;
  salary: number;
}

const people: Person[] = [
  { id: "1", name: "Alice Wonderland", role: "Chancellor", salary: 120000 },
  { id: "2", name: "Bob Builder", role: "Minister of Labor", salary: 95000 },
  { id: "3", name: "Charlie Chaplin", role: "Cultural Envoy", salary: 80000 },
  { id: "4", name: "Diana Prince", role: "Defense Strategist", salary: 110000 },
];

const columns: FacetColumn<Person>[] = [
  { key: "name", header: "Full Name", sortable: true, mobileRole: "hero" },
  { key: "role", header: "Role", mobileRole: "subtitle" },
  { key: "salary", header: "Compensation", sortable: true, mobileRole: "field" },
];

const firstRow = () => screen.getAllByRole("row")[1]?.textContent;

describe("FacetDataTable", () => {
  it("narrows the rows to a search", () => {
    render(
      <FacetDataTable data={people} columns={columns} searchable searchPlaceholder="Search leaders..." layoutMode="table" />
    );
    fireEvent.change(screen.getByPlaceholderText("Search leaders..."), { target: { value: "Charlie" } });
    expect(screen.queryByText("Alice Wonderland")).toBeNull();
    expect(screen.getByText("Charlie Chaplin")).toBeInTheDocument();
  });

  it("sorts from a header button that reports aria-sort, ascending then descending", () => {
    render(<FacetDataTable data={people} columns={columns} layoutMode="table" />);
    const header = screen.getByRole("columnheader", { name: "Full Name" });
    expect(header).toHaveAttribute("aria-sort", "none");
    fireEvent.click(screen.getByRole("button", { name: "Full Name" }));
    expect(header).toHaveAttribute("aria-sort", "ascending");
    expect(firstRow()).toContain("Alice Wonderland");
    fireEvent.click(screen.getByRole("button", { name: "Full Name" }));
    expect(header).toHaveAttribute("aria-sort", "descending");
    expect(firstRow()).toContain("Diana Prince");
  });

  it("pages the rows", () => {
    render(<FacetDataTable data={people} columns={columns} paginated pageSize={2} layoutMode="table" />);
    expect(screen.queryByText("Charlie Chaplin")).toBeNull();
    fireEvent.click(screen.getByLabelText("Next Page"));
    expect(screen.queryByText("Alice Wonderland")).toBeNull();
    expect(screen.getByText("Diana Prince")).toBeInTheDocument();
  });

  it("opens a row from its mobile card by click and by keyboard", () => {
    const onRowClick = jest.fn();
    const { container } = render(
      <FacetDataTable data={people} columns={columns} layoutMode="cards" onRowClick={onRowClick} />
    );
    fireEvent.click(screen.getByText("Alice Wonderland"));
    const card = container.querySelectorAll('[data-slot="facet-mobile-card"]')[1]!;
    fireEvent.keyDown(card, { key: "Enter" });
    expect(onRowClick.mock.calls).toEqual([[people[0]], [people[1]]]);
  });

  it("marks itself busy while loading", () => {
    const { container } = render(<FacetDataTable data={[]} columns={columns} loading />);
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });
});

test("pagination is a named nav with the current page marked", () => {
  render(
    <FacetTablePagination currentPage={2} totalPages={3} totalItems={30} pageSize={10} onPageChange={() => {}} />
  );
  expect(screen.getByRole("navigation", { name: "Pagination" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
});
