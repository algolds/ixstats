import { type PrismaClient, type EconomicComponentType, type TaxComponentType } from "@prisma/client";

export interface CreateEconomicComponentInput {
  countryId: string;
  componentType: EconomicComponentType;
  effectivenessScore?: number;
  implementationCost?: number;
  maintenanceCost?: number;
  requiredCapacity?: number;
  notes?: string;
}

export interface UpdateEconomicComponentInput {
  id: string;
  effectivenessScore?: number;
  isActive?: boolean;
  notes?: string;
}

export interface BulkEconomicItem {
  componentType: EconomicComponentType;
  effectivenessScore?: number;
  isActive?: boolean;
  implementationCost?: number;
  maintenanceCost?: number;
  requiredCapacity?: number;
  notes?: string;
}

export interface CreateTaxComponentInput {
  countryId: string;
  componentType: TaxComponentType;
  effectivenessScore?: number;
  implementationCost?: number;
  maintenanceCost?: number;
  requiredCapacity?: number;
  notes?: string;
}

export interface UpdateTaxComponentInput {
  id: string;
  effectivenessScore?: number;
  isActive?: boolean;
  notes?: string;
}

export interface BulkTaxItem {
  componentType: TaxComponentType;
  effectivenessScore?: number;
  isActive?: boolean;
  implementationCost?: number;
  maintenanceCost?: number;
  requiredCapacity?: number;
  notes?: string;
}

export interface BudgetScenarioCategoryInput {
  categoryName: string;
  allocatedAmount: number;
  allocatedPercent: number;
  priority: "critical" | "high" | "medium" | "low";
  efficiency?: number;
  performance?: number;
}

export interface CreateBudgetScenarioInput {
  countryId: string;
  name: string;
  description?: string;
  totalBudget: number;
  assumptions?: string;
  riskLevel: "low" | "medium" | "high";
  feasibility?: number;
  categories: BudgetScenarioCategoryInput[];
}

export async function createEconomicComponentTx(
  db: PrismaClient | any,
  input: CreateEconomicComponentInput,
  userId: string
) {
  return await db.$transaction(async (tx: any) => {
    const component = await tx.economicComponent.create({
      data: {
        ...input,
        implementationDate: new Date(),
      },
    });

    await tx.componentChangeLog.create({
      data: {
        countryId: input.countryId,
        componentType: "ECONOMIC",
        componentId: component.id,
        changeType: "ADDED",
        newValue: JSON.stringify(component),
        triggeredBy: userId,
        description: `Added economic component: ${input.componentType}`,
      },
    });

    return component;
  });
}

export async function updateEconomicComponentTx(
  db: PrismaClient | any,
  input: UpdateEconomicComponentInput,
  existing: any,
  userId: string
) {
  return await db.$transaction(async (tx: any) => {
    const updated = await tx.economicComponent.update({
      where: { id: input.id },
      data: {
        effectivenessScore: input.effectivenessScore,
        isActive: input.isActive,
        notes: input.notes,
      },
    });

    await tx.componentChangeLog.create({
      data: {
        countryId: existing.countryId,
        componentType: "ECONOMIC",
        componentId: input.id,
        changeType: "MODIFIED",
        previousValue: JSON.stringify(existing),
        newValue: JSON.stringify(updated),
        triggeredBy: userId,
        description: `Updated economic component: ${existing.componentType}`,
      },
    });

    return updated;
  });
}

export async function removeEconomicComponentTx(
  db: PrismaClient | any,
  id: string,
  existing: any,
  userId: string
) {
  return await db.$transaction(async (tx: any) => {
    const updated = await tx.economicComponent.update({
      where: { id },
      data: { isActive: false },
    });

    await tx.componentChangeLog.create({
      data: {
        countryId: existing.countryId,
        componentType: "ECONOMIC",
        componentId: id,
        changeType: "REMOVED",
        previousValue: JSON.stringify(existing),
        newValue: JSON.stringify(updated),
        triggeredBy: userId,
        description: `Removed economic component: ${existing.componentType}`,
      },
    });

    return updated;
  });
}

export async function bulkUpdateEconomicComponentsTx(
  db: PrismaClient | any,
  countryId: string,
  components: BulkEconomicItem[],
  userId: string
) {
  return await db.$transaction(async (tx: any) => {
    const existing = await tx.economicComponent.findMany({
      where: { countryId },
    });

    const existingMap = new Map(existing.map((comp: any) => [comp.componentType, comp]));
    const results = [];

    for (const componentData of components) {
      const existingComp = existingMap.get(componentData.componentType) as any;

      if (existingComp) {
        const updated = await tx.economicComponent.update({
          where: { id: existingComp.id },
          data: {
            effectivenessScore: componentData.effectivenessScore,
            isActive: componentData.isActive,
            implementationCost: componentData.implementationCost,
            maintenanceCost: componentData.maintenanceCost,
            requiredCapacity: componentData.requiredCapacity,
            notes: componentData.notes,
          },
        });

        await tx.componentChangeLog.create({
          data: {
            countryId,
            componentType: "ECONOMIC",
            componentId: existingComp.id,
            changeType: "MODIFIED",
            previousValue: JSON.stringify(existingComp),
            newValue: JSON.stringify(updated),
            triggeredBy: userId,
            description: `Updated economic component: ${componentData.componentType}`,
          },
        });

        results.push(updated);
      } else {
        const created = await tx.economicComponent.create({
          data: {
            countryId,
            ...componentData,
            implementationDate: new Date(),
          },
        });

        await tx.componentChangeLog.create({
          data: {
            countryId,
            componentType: "ECONOMIC",
            componentId: created.id,
            changeType: "ADDED",
            newValue: JSON.stringify(created),
            triggeredBy: userId,
            description: `Added economic component: ${componentData.componentType}`,
          },
        });

        results.push(created);
      }
    }

    const newTypes = new Set(components.map((c) => c.componentType));
    for (const existingComp of existingMap.values() as any) {
      if (!newTypes.has(existingComp.componentType) && existingComp.isActive) {
        const updated = await tx.economicComponent.update({
          where: { id: existingComp.id },
          data: { isActive: false },
        });

        await tx.componentChangeLog.create({
          data: {
            countryId,
            componentType: "ECONOMIC",
            componentId: existingComp.id,
            changeType: "REMOVED",
            previousValue: JSON.stringify(existingComp),
            newValue: JSON.stringify(updated),
            triggeredBy: userId,
            description: `Removed economic component: ${existingComp.componentType}`,
          },
        });

        results.push(updated);
      }
    }

    return results;
  });
}

export async function createTaxComponentTx(
  db: PrismaClient | any,
  input: CreateTaxComponentInput,
  userId: string
) {
  return await db.$transaction(async (tx: any) => {
    const component = await tx.taxComponent.create({
      data: {
        ...input,
        implementationDate: new Date(),
      },
    });

    await tx.componentChangeLog.create({
      data: {
        countryId: input.countryId,
        componentType: "TAX",
        componentId: component.id,
        changeType: "ADDED",
        newValue: JSON.stringify(component),
        triggeredBy: userId,
        description: `Added tax component: ${input.componentType}`,
      },
    });

    return component;
  });
}

export async function updateTaxComponentTx(
  db: PrismaClient | any,
  input: UpdateTaxComponentInput,
  existing: any,
  userId: string
) {
  return await db.$transaction(async (tx: any) => {
    const updated = await tx.taxComponent.update({
      where: { id: input.id },
      data: {
        effectivenessScore: input.effectivenessScore,
        isActive: input.isActive,
        notes: input.notes,
      },
    });

    await tx.componentChangeLog.create({
      data: {
        countryId: existing.countryId,
        componentType: "TAX",
        componentId: input.id,
        changeType: "MODIFIED",
        previousValue: JSON.stringify(existing),
        newValue: JSON.stringify(updated),
        triggeredBy: userId,
        description: `Updated tax component: ${existing.componentType}`,
      },
    });

    return updated;
  });
}

export async function removeTaxComponentTx(
  db: PrismaClient | any,
  id: string,
  existing: any,
  userId: string
) {
  return await db.$transaction(async (tx: any) => {
    const updated = await tx.taxComponent.update({
      where: { id },
      data: { isActive: false },
    });

    await tx.componentChangeLog.create({
      data: {
        countryId: existing.countryId,
        componentType: "TAX",
        componentId: id,
        changeType: "REMOVED",
        previousValue: JSON.stringify(existing),
        newValue: JSON.stringify(updated),
        triggeredBy: userId,
        description: `Removed tax component: ${existing.componentType}`,
      },
    });

    return updated;
  });
}

export async function bulkUpdateTaxComponentsTx(
  db: PrismaClient | any,
  countryId: string,
  components: BulkTaxItem[],
  userId: string
) {
  return await db.$transaction(async (tx: any) => {
    const existing = await tx.taxComponent.findMany({
      where: { countryId },
    });

    const existingMap = new Map(existing.map((comp: any) => [comp.componentType, comp]));
    const results = [];

    for (const componentData of components) {
      const existingComp = existingMap.get(componentData.componentType) as any;

      if (existingComp) {
        const updated = await tx.taxComponent.update({
          where: { id: existingComp.id },
          data: {
            effectivenessScore: componentData.effectivenessScore,
            isActive: componentData.isActive,
            implementationCost: componentData.implementationCost,
            maintenanceCost: componentData.maintenanceCost,
            requiredCapacity: componentData.requiredCapacity,
            notes: componentData.notes,
          },
        });

        await tx.componentChangeLog.create({
          data: {
            countryId,
            componentType: "TAX",
            componentId: existingComp.id,
            changeType: "MODIFIED",
            previousValue: JSON.stringify(existingComp),
            newValue: JSON.stringify(updated),
            triggeredBy: userId,
            description: `Updated tax component: ${componentData.componentType}`,
          },
        });

        results.push(updated);
      } else {
        const created = await tx.taxComponent.create({
          data: {
            countryId,
            ...componentData,
            implementationDate: new Date(),
          },
        });

        await tx.componentChangeLog.create({
          data: {
            countryId,
            componentType: "TAX",
            componentId: created.id,
            changeType: "ADDED",
            newValue: JSON.stringify(created),
            triggeredBy: userId,
            description: `Added tax component: ${componentData.componentType}`,
          },
        });

        results.push(created);
      }
    }

    const newTypes = new Set(components.map((c) => c.componentType));
    for (const existingComp of existingMap.values() as any) {
      if (!newTypes.has(existingComp.componentType) && existingComp.isActive) {
        const updated = await tx.taxComponent.update({
          where: { id: existingComp.id },
          data: { isActive: false },
        });

        await tx.componentChangeLog.create({
          data: {
            countryId,
            componentType: "TAX",
            componentId: existingComp.id,
            changeType: "REMOVED",
            previousValue: JSON.stringify(existingComp),
            newValue: JSON.stringify(updated),
            triggeredBy: userId,
            description: `Removed tax component: ${existingComp.componentType}`,
          },
        });

        results.push(updated);
      }
    }

    return results;
  });
}

export async function createBudgetScenarioTx(
  db: PrismaClient | any,
  input: CreateBudgetScenarioInput
) {
  const { categories, ...scenarioData } = input;

  return await db.$transaction(async (tx: any) => {
    const scenario = await tx.budgetScenario.create({
      data: scenarioData,
    });

    await tx.budgetScenarioCategory.createMany({
      data: categories.map((category) => ({
        ...category,
        scenarioId: scenario.id,
      })),
    });

    return scenario;
  });
}
