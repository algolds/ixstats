import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import DiplomaticScenariosPage from "~/app/admin/diplomatic-scenarios/page";

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
  scenarios: [
    {
      id: "scen-1",
      title: "Border Dispute",
      narrative: "Tensions flare at border checkpoint",
      type: "border_dispute",
      relationshipState: "tense",
      culturalImpact: 40,
      diplomaticRisk: 60,
      status: "active",
      tags: ["border_dispute", "critical", "urgent"],
      responseOptions: [],
    },
  ],
  filteredScenarios: [
    {
      id: "scen-1",
      title: "Border Dispute",
      narrative: "Tensions flare at border checkpoint",
      type: "border_dispute",
      relationshipState: "tense",
      culturalImpact: 40,
      diplomaticRisk: 60,
      status: "active",
      tags: ["border_dispute", "critical", "urgent"],
      responseOptions: [],
    },
  ],
  countries: [],
  isLoading: false,
  isPending: false,
  typeFilter: "all",
  setTypeFilter: jest.fn(),
  relationshipFilter: [],
  setRelationshipFilter: jest.fn(),
  difficultyFilter: [],
  setDifficultyFilter: jest.fn(),
  timeFrameFilter: [],
  setTimeFrameFilter: jest.fn(),
  searchQuery: "",
  setSearchQuery: jest.fn(),
  showInactive: false,
  setShowInactive: jest.fn(),
  selectedIds: new Set(),
  setSelectedIds: jest.fn(),
  handleSelectAll: jest.fn(),
  handleToggleSelect: jest.fn(),
  handleBulkActivate: jest.fn(),
  handleBulkDeactivate: jest.fn(),
  isAddDialogOpen: false,
  setIsAddDialogOpen: jest.fn(),
  editingScenario: null,
  activeTab: "general",
  setActiveTab: jest.fn(),
  handleCloseDialog: jest.fn(),
  editingChoiceIndex: null,
  setEditingChoiceIndex: jest.fn(),
  choiceFormData: {},
  setChoiceFormData: jest.fn(),
  handleAddChoice: jest.fn(),
  handleEditChoice: jest.fn(),
  handleSaveChoice: jest.fn(),
  handleDeleteChoice: jest.fn(),
  handleCancelChoiceEdit: jest.fn(),
  formData: {},
  setFormData: jest.fn(),
  responseOptions: [],
  setResponseOptions: jest.fn(),
  resetForm: jest.fn(),
  handleCreate: jest.fn(),
  handleUpdate: jest.fn(),
  handleDelete: jest.fn(),
  handleEdit: jest.fn(),
  handleClone: jest.fn(),
};

jest.mock("~/hooks/admin/useDiplomaticScenariosAdmin", () => ({
  useDiplomaticScenariosAdmin: () => mockAdminHook,
}));

describe("DiplomaticScenariosPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders loading state when auth is not loaded", () => {
    mockUseUser.mockReturnValue({ isLoaded: false, user: null });
    render(<DiplomaticScenariosPage />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  test("renders sign-in button when unauthenticated", () => {
    mockUseUser.mockReturnValue({ isLoaded: true, user: null });
    render(<DiplomaticScenariosPage />);
    expect(screen.getByText("Sign In")).toBeInTheDocument();
  });

  test("renders access denied when user lacks admin role", () => {
    mockUseUser.mockReturnValue({
      isLoaded: true,
      user: { id: "user-1", publicMetadata: { role: "member" } },
    });
    render(<DiplomaticScenariosPage />);
    expect(screen.getByText("Access Denied")).toBeInTheDocument();
  });

  test("renders diplomatic scenarios dashboard when user is admin", () => {
    mockUseUser.mockReturnValue({
      isLoaded: true,
      user: { id: "user-admin", publicMetadata: { role: "admin" } },
    });
    render(<DiplomaticScenariosPage />);
    expect(screen.getByText("Diplomatic Scenarios")).toBeInTheDocument();
    expect(screen.getByText("Back to Admin")).toBeInTheDocument();
    expect(screen.getByText("Border Dispute")).toBeInTheDocument();
  });
});
