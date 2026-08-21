import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import GovernmentComponentsPage from "~/app/admin/government-components/page";

// Mock auth context
const mockUseUser = jest.fn();
jest.mock("~/context/auth-context", () => ({
  useUser: () => mockUseUser(),
  SignInButton: () => <button>Sign In</button>,
}));

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

describe("GovernmentComponentsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders loading state when auth is not loaded", () => {
    mockUseUser.mockReturnValue({ isLoaded: false, user: null });
    render(<GovernmentComponentsPage />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  test("renders sign-in button when unauthenticated", () => {
    mockUseUser.mockReturnValue({ isLoaded: true, user: null });
    render(<GovernmentComponentsPage />);
    expect(screen.getByText("Sign In")).toBeInTheDocument();
  });

  test("renders access denied when user lacks admin role", () => {
    mockUseUser.mockReturnValue({
      isLoaded: true,
      user: { id: "user-1", publicMetadata: { role: "member" } },
    });
    render(<GovernmentComponentsPage />);
    expect(screen.getByText("Access Denied")).toBeInTheDocument();
  });

  test("renders government components dashboard when user is admin", () => {
    mockUseUser.mockReturnValue({
      isLoaded: true,
      user: { id: "user-admin", publicMetadata: { role: "admin" } },
    });
    render(<GovernmentComponentsPage />);
    expect(screen.getByText("Government Components")).toBeInTheDocument();
    expect(screen.getByText("Back to Admin")).toBeInTheDocument();
    expect(screen.getByText("Centralized Power")).toBeInTheDocument();
    expect(screen.getByText("Total Components")).toBeInTheDocument();
  });
});
