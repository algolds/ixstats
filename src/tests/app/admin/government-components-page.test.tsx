import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { GovernmentComponentsPanel } from "~/app/admin/government-components/GovernmentComponentsPanel";

// Mock hooks
jest.mock("~/hooks/usePageTitle", () => ({
  usePageTitle: jest.fn(),
}));

// Mock admin hook
const mockAdminHook = {
  components: [
    {
      id: "gov-1",
      name: "Centralized Power",
      description: "Unitary authority",
      category: "Power Distribution",
      effectiveness: 80,
      implementationCost: 500000,
      maintenanceCost: 100000,
      isActive: true,
      metadata: { complexity: "Medium" },
      color: "blue",
      icon: "Building2",
    },
  ],
  filteredComponents: [
    {
      id: "gov-1",
      name: "Centralized Power",
      description: "Unitary authority",
      category: "Power Distribution",
      effectiveness: 80,
      implementationCost: 500000,
      maintenanceCost: 100000,
      isActive: true,
      metadata: { complexity: "Medium" },
      color: "blue",
      icon: "Building2",
    },
  ],
  stats: {
    totalComponents: 1,
    activeComponents: 1,
    totalUsage: 10,
    totalSynergies: 2,
  },
  isLoading: false,
  isPending: false,
  searchTerm: "",
  setSearchTerm: jest.fn(),
  categoryFilter: "all",
  setCategoryFilter: jest.fn(),
  complexityFilter: "all",
  setComplexityFilter: jest.fn(),
  showActiveOnly: true,
  setShowActiveOnly: jest.fn(),
  editingComponent: null,
  isAddDialogOpen: false,
  setIsAddDialogOpen: jest.fn(),
  isSynergyMatrixOpen: false,
  setIsSynergyMatrixOpen: jest.fn(),
  activeTab: "general",
  setActiveTab: jest.fn(),
  formData: {},
  setFormData: jest.fn(),
  resetForm: jest.fn(),
  handleCreate: jest.fn(),
  handleUpdate: jest.fn(),
  handleDelete: jest.fn(),
  handleEdit: jest.fn(),
  handleCloseEditor: jest.fn(),
  createSynergyMutation: { mutate: jest.fn() },
};

jest.mock("~/hooks/admin/useGovernmentComponentsAdmin", () => ({
  useGovernmentComponentsAdmin: () => mockAdminHook,
}));

describe("GovernmentComponentsPanel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders loading skeletons when isLoading is true", () => {
    jest.spyOn(require("~/hooks/admin/useGovernmentComponentsAdmin"), "useGovernmentComponentsAdmin").mockReturnValueOnce({
      ...mockAdminHook,
      isLoading: true,
    });
    const { container } = render(<GovernmentComponentsPanel />);
    expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
  });

  test("renders government components dashboard with components and stats", () => {
    render(<GovernmentComponentsPanel />);
    expect(screen.getByText("Government Components")).toBeInTheDocument();
    expect(screen.getByText("Centralized Power")).toBeInTheDocument();
    expect(screen.getByText("Total Components")).toBeInTheDocument();
  });
});
