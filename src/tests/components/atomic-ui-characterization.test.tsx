import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { UnifiedAtomicComponentSelector } from "../../components/ui/atomic/shared/UnifiedAtomicComponentSelector";
import type {
  UnifiedAtomicComponent,
  AtomicComponentTheme,
  EffectivenessMetrics,
} from "../../components/ui/atomic/shared/types";

describe("atomic-ui characterization contract", () => {
  const mockComponents: Record<string, UnifiedAtomicComponent> = {
    comp_1: {
      id: "comp_1",
      name: "Component One",
      category: "government",
      description: "First test component",
      effectiveness: 10,
      implementationCost: 100,
      maintenanceCost: 10,
      prerequisites: [],
      synergies: [],
      conflicts: [],
      metadata: {
        complexity: "Low",
        timeToImplement: "1 turn",
        staffRequired: 1,
        technologyRequired: false,
      },
    },
    comp_2: {
      id: "comp_2",
      name: "Component Two",
      category: "government",
      description: "Second test component",
      effectiveness: 20,
      implementationCost: 200,
      maintenanceCost: 20,
      prerequisites: [],
      synergies: [],
      conflicts: [],
      metadata: {
        complexity: "Medium",
        timeToImplement: "2 turns",
        staffRequired: 2,
        technologyRequired: false,
      },
    },
    comp_3: {
      id: "comp_3",
      name: "Component Three",
      category: "government",
      description: "Third test component",
      effectiveness: 30,
      implementationCost: 300,
      maintenanceCost: 30,
      prerequisites: [],
      synergies: [],
      conflicts: [],
      metadata: {
        complexity: "High",
        timeToImplement: "3 turns",
        staffRequired: 3,
        technologyRequired: true,
      },
    },
  };

  const categories = {
    government: ["comp_1", "comp_2", "comp_3"],
  };

  const theme: AtomicComponentTheme = {
    type: "unified",
    primary: "cyan",
  };

  const mockCalculateEffectiveness = (selected: string[]): EffectivenessMetrics => ({
    baseEffectiveness: selected.length * 10,
    synergyBonus: 0,
    conflictPenalty: 0,
    totalEffectiveness: selected.length * 10,
    synergyCount: 0,
    conflictCount: 0,
  });

  const mockIcon = () => <span data-testid="system-icon" />;

  it("selects and deselects components on click", () => {
    const handleComponentChange = jest.fn();

    const { rerender } = render(
      <UnifiedAtomicComponentSelector
        theme={theme}
        systemName="Government Systems"
        systemIcon={mockIcon}
        calculateEffectiveness={mockCalculateEffectiveness}
        checkSynergy={() => 0}
        checkConflict={() => false}
        selectedComponents={[]}
        onComponentChange={handleComponentChange}
        components={mockComponents}
        categories={categories}
        maxComponents={2}
      />
    );

    const comp1Button = screen.getByText("Component One");
    fireEvent.click(comp1Button);
    expect(handleComponentChange).toHaveBeenCalledWith(["comp_1"]);

    // Rerender as selected
    rerender(
      <UnifiedAtomicComponentSelector
        theme={theme}
        systemName="Government Systems"
        systemIcon={mockIcon}
        calculateEffectiveness={mockCalculateEffectiveness}
        checkSynergy={() => 0}
        checkConflict={() => false}
        selectedComponents={["comp_1"]}
        onComponentChange={handleComponentChange}
        components={mockComponents}
        categories={categories}
        maxComponents={2}
      />
    );

    fireEvent.click(comp1Button);
    expect(handleComponentChange).toHaveBeenCalledWith([]);
  });

  it("enforces maxComponents limit when selecting", () => {
    const handleComponentChange = jest.fn();

    render(
      <UnifiedAtomicComponentSelector
        theme={theme}
        systemName="Government Systems"
        systemIcon={mockIcon}
        calculateEffectiveness={mockCalculateEffectiveness}
        checkSynergy={() => 0}
        checkConflict={() => false}
        selectedComponents={["comp_1", "comp_2"]}
        onComponentChange={handleComponentChange}
        components={mockComponents}
        categories={categories}
        maxComponents={2}
      />
    );

    const comp3Button = screen.getByText("Component Three");
    fireEvent.click(comp3Button);
    // Should NOT call onComponentChange because maxComponents is 2 and 2 are selected
    expect(handleComponentChange).not.toHaveBeenCalled();
  });

  it("prevents changes when isReadOnly is true", () => {
    const handleComponentChange = jest.fn();

    render(
      <UnifiedAtomicComponentSelector
        theme={theme}
        systemName="Government Systems"
        systemIcon={mockIcon}
        calculateEffectiveness={mockCalculateEffectiveness}
        checkSynergy={() => 0}
        checkConflict={() => false}
        selectedComponents={["comp_1"]}
        onComponentChange={handleComponentChange}
        components={mockComponents}
        categories={categories}
        isReadOnly={true}
        maxComponents={3}
      />
    );

    const comp2Button = screen.getByText("Component Two");
    fireEvent.click(comp2Button);
    expect(handleComponentChange).not.toHaveBeenCalled();
  });
});
