import React from "react";
// @ts-ignore
import { render, fireEvent } from "@testing-library/react";
import { describe, it, expect, jest } from "@jest/globals";
import { FacetDataTable } from "~/components/ui/data-table/FacetDataTable";
import type { FacetColumn } from "~/components/ui/data-table/types";

interface TestPerson {
  id: string;
  name: string;
  role: string;
  department: string;
  salary: number;
  status: "Active" | "Inactive";
}

const mockData: TestPerson[] = [
  {
    id: "1",
    name: "Alice Wonderland",
    role: "Chancellor",
    department: "Executive",
    salary: 120000,
    status: "Active",
  },
  {
    id: "2",
    name: "Bob Builder",
    role: "Minister of Labor",
    department: "Infrastructure",
    salary: 95000,
    status: "Active",
  },
  {
    id: "3",
    name: "Charlie Chaplin",
    role: "Cultural Envoy",
    department: "Diplomacy",
    salary: 80000,
    status: "Inactive",
  },
  {
    id: "4",
    name: "Diana Prince",
    role: "Defense Strategist",
    department: "Security",
    salary: 110000,
    status: "Active",
  },
];

const mockColumns: FacetColumn<TestPerson>[] = [
  {
    key: "name",
    header: "Full Name",
    sortable: true,
    mobileRole: "hero",
  },
  {
    key: "role",
    header: "Role",
    mobileRole: "subtitle",
  },
  {
    key: "status",
    header: "Status",
    mobileRole: "badge",
    render: (val: unknown) => <span data-testid="status-badge">{String(val)}</span>,
  },
  {
    key: "department",
    header: "Department",
    mobileRole: "field",
    mobileLabel: "Dept",
  },
  {
    key: "salary",
    header: "Compensation",
    sortable: true,
    mobileRole: "field",
    render: (val: unknown) => `$${Number(val).toLocaleString()}`,
    mobileRender: (val: unknown) => `$${Number(val) / 1000}k`,
  },
  {
    key: "id",
    header: "System ID",
    hideOnMobile: true,
  },
];

describe("FacetDataTable Component", () => {
  it("renders table headers and rows in table mode", () => {
    const { getByText } = render(
      <FacetDataTable
        data={mockData}
        columns={mockColumns}
        layoutMode="table"
        title="Leadership Directory"
      />
    );

    expect(getByText("Leadership Directory")).toBeTruthy();
    expect(getByText("Full Name")).toBeTruthy();
    expect(getByText("Alice Wonderland")).toBeTruthy();
    expect(getByText("Bob Builder")).toBeTruthy();
    expect(getByText("$120,000")).toBeTruthy();
  });

  it("renders mobile cards with mobileRole hierarchy in cards mode", () => {
    const { getByText, getAllByText, queryByText } = render(
      <FacetDataTable data={mockData} columns={mockColumns} layoutMode="cards" />
    );

    expect(getByText("Alice Wonderland")).toBeTruthy();
    expect(getByText("Chancellor")).toBeTruthy();

    // mobileRender overrides compensation format
    expect(getByText("$120k")).toBeTruthy();
    // mobileLabel overrides department label
    expect(getAllByText("Dept").length).toBeGreaterThan(0);
    // hideOnMobile hides System ID
    expect(queryByText("System ID")).toBeNull();
  });

  it("filters data based on search input", () => {
    const { getByText, getByPlaceholderText, queryByText } = render(
      <FacetDataTable
        data={mockData}
        columns={mockColumns}
        searchable
        searchPlaceholder="Search leaders..."
        layoutMode="table"
      />
    );

    const searchInput = getByPlaceholderText("Search leaders...");
    expect(getByText("Alice Wonderland")).toBeTruthy();
    expect(getByText("Bob Builder")).toBeTruthy();

    fireEvent.change(searchInput, { target: { value: "Charlie" } });

    expect(queryByText("Alice Wonderland")).toBeNull();
    expect(getByText("Charlie Chaplin")).toBeTruthy();
  });

  it("sorts data when clicking sortable column headers", () => {
    const { getByText, getAllByRole } = render(
      <FacetDataTable data={mockData} columns={mockColumns} layoutMode="table" />
    );

    const nameHeader = getByText("Full Name");

    // First click: Sort Ascending (Alice, Bob, Charlie, Diana)
    fireEvent.click(nameHeader);
    const rowsAsc = getAllByRole("row");
    expect(rowsAsc[1]?.textContent).toContain("Alice Wonderland");

    // Second click: Sort Descending (Diana, Charlie, Bob, Alice)
    fireEvent.click(nameHeader);
    const rowsDesc = getAllByRole("row");
    expect(rowsDesc[1]?.textContent).toContain("Diana Prince");
  });

  it("paginates records correctly", () => {
    const { getByText, getByLabelText, queryByText } = render(
      <FacetDataTable
        data={mockData}
        columns={mockColumns}
        paginated
        pageSize={2}
        layoutMode="table"
      />
    );

    expect(getByText("Alice Wonderland")).toBeTruthy();
    expect(getByText("Bob Builder")).toBeTruthy();
    expect(queryByText("Charlie Chaplin")).toBeNull();

    // Go to page 2
    const nextBtn = getByLabelText("Next Page");
    fireEvent.click(nextBtn);

    expect(queryByText("Alice Wonderland")).toBeNull();
    expect(getByText("Charlie Chaplin")).toBeTruthy();
    expect(getByText("Diana Prince")).toBeTruthy();
  });

  it("handles onRowClick event on cards", () => {
    const handleRowClick = jest.fn();

    const { getByText } = render(
      <FacetDataTable
        data={mockData}
        columns={mockColumns}
        layoutMode="cards"
        onRowClick={handleRowClick}
      />
    );

    const firstHero = getByText("Alice Wonderland");
    fireEvent.click(firstHero);

    expect(handleRowClick).toHaveBeenCalledWith(mockData[0]);
  });
});
