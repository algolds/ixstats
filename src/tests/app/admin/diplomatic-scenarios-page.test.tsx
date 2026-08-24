import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DiplomaticScenariosPanel } from "~/app/admin/diplomatic-scenarios/DiplomaticScenariosPanel";

// Mock hooks
jest.mock("~/hooks/usePageTitle", () => ({
  usePageTitle: jest.fn(),
}));

jest.mock("~/context/auth-context", () => ({
  useUser: () => ({ user: { id: "admin_1", role: "admin" } }),
  AuthProvider: ({ children }: any) => children,
}));

jest.mock("~/app/admin/diplomatic-scenarios/_components/DiplomaticScenariosAnalyticsTab", () => ({
  DiplomaticScenariosAnalyticsTab: () => <div data-testid="mock-analytics-tab">Analytics Content</div>,
}));

// Mock admin hook
const mockAdminHook = {
  scenarios: [
    {
      id: "scen-1",
      title: "Border Dispute Scenario",
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
      title: "Border Dispute Scenario",
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

describe("DiplomaticScenariosPanel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders loading skeletons when isLoading is true", () => {
    jest
      .spyOn(require("~/hooks/admin/useDiplomaticScenariosAdmin"), "useDiplomaticScenariosAdmin")
      .mockReturnValueOnce({
        ...mockAdminHook,
        isLoading: true,
      });
    const { container } = render(<DiplomaticScenariosPanel />);
    expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
  });

  test("renders diplomatic scenarios dashboard header and scenarios", () => {
    render(<DiplomaticScenariosPanel />);
    expect(screen.getByText("Diplomatic Scenarios")).toBeInTheDocument();
    expect(screen.getByText("Border Dispute Scenario")).toBeInTheDocument();
    expect(screen.getByText("Scenarios")).toBeInTheDocument();
    expect(screen.getByText("Analytics")).toBeInTheDocument();
  });

  test("renders empty state message when no scenarios match filters", () => {
    jest
      .spyOn(require("~/hooks/admin/useDiplomaticScenariosAdmin"), "useDiplomaticScenariosAdmin")
      .mockReturnValueOnce({
        ...mockAdminHook,
        filteredScenarios: [],
      });
    render(<DiplomaticScenariosPanel />);
    expect(screen.getByText("No scenarios found matching your filters")).toBeInTheDocument();
  });
});
