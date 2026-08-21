import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import EconomicComponentsPage from "~/app/admin/economic-components/page";

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
      id: "comp-1",
      name: "Free Market System",
      description: "Laissez-faire economy",
      category: "Economic Model",
      effectiveness: 85,
      implementationCost: 500000,
      maintenanceCost: 100000,
      isActive: true,
      metadata: { complexity: "Medium" },
      taxImpact: { optimalCorporateRate: 20, optimalIncomeRate: 25, revenueEfficiency: 75 },
      sectorImpact: { services: 1.2, finance: 1.1, technology: 1.3, manufacturing: 1.0, agriculture: 0.9, government: 0.8 },
      employmentImpact: { unemploymentModifier: -0.5, participationModifier: 1.1, wageGrowthModifier: 1.2 },
      color: "emerald",
      icon: "Factory",
    },
  ],
  filteredComponents: [
    {
      id: "comp-1",
      name: "Free Market System",
      description: "Laissez-faire economy",
      category: "Economic Model",
      effectiveness: 85,
      implementationCost: 500000,
      maintenanceCost: 100000,
      isActive: true,
      metadata: { complexity: "Medium" },
      taxImpact: { optimalCorporateRate: 20, optimalIncomeRate: 25, revenueEfficiency: 75 },
      sectorImpact: { services: 1.2, finance: 1.1, technology: 1.3, manufacturing: 1.0, agriculture: 0.9, government: 0.8 },
      employmentImpact: { unemploymentModifier: -0.5, participationModifier: 1.1, wageGrowthModifier: 1.2 },
      color: "emerald",
      icon: "Factory",
    },
  ],
  stats: {
    totalComponents: 1,
    activeComponents: 1,
    totalUsage: 10,
    totalSynergies: 2,
    totalTemplates: 3,
  },
  templates: [],
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
  isTemplateManagerOpen: false,
  setIsTemplateManagerOpen: jest.fn(),
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

jest.mock("~/hooks/admin/useEconomicComponentsAdmin", () => ({
  useEconomicComponentsAdmin: () => mockAdminHook,
}));

describe("EconomicComponentsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders loading state when auth is not loaded", () => {
    mockUseUser.mockReturnValue({ isLoaded: false, user: null });
    render(<EconomicComponentsPage />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  test("renders sign-in button when unauthenticated", () => {
    mockUseUser.mockReturnValue({ isLoaded: true, user: null });
    render(<EconomicComponentsPage />);
    expect(screen.getByText("Sign In")).toBeInTheDocument();
  });

  test("renders access denied when user lacks admin role", () => {
    mockUseUser.mockReturnValue({
      isLoaded: true,
      user: { id: "user-1", publicMetadata: { role: "member" } },
    });
    render(<EconomicComponentsPage />);
    expect(screen.getByText("Access Denied")).toBeInTheDocument();
  });

  test("renders economic components dashboard when user is admin", () => {
    mockUseUser.mockReturnValue({
      isLoaded: true,
      user: { id: "user-admin", publicMetadata: { role: "admin" } },
    });
    render(<EconomicComponentsPage />);
    expect(screen.getByText("Economic Components")).toBeInTheDocument();
    expect(screen.getByText("Back to Admin")).toBeInTheDocument();
    expect(screen.getByText("Free Market System")).toBeInTheDocument();
    expect(screen.getByText("Total Components")).toBeInTheDocument();
  });
});
