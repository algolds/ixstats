import {
  type PrismaClient,
  type EconomicComponentType,
  type TaxComponentType,
} from "@prisma/client";

interface CreateComponentInput<T> {
  countryId: string;
  componentType: T;
  effectivenessScore?: number;
  implementationCost?: number;
  maintenanceCost?: number;
  requiredCapacity?: number;
  notes?: string;
}

interface UpdateComponentInput {
  id: string;
  effectivenessScore?: number;
  isActive?: boolean;
  notes?: string;
}

interface BulkComponentItem<T> extends CreateComponentInput<T> {
  isActive?: boolean;
}

const COMPONENT_KINDS = {
  ECONOMIC: { model: "economicComponent", label: "economic" },
  TAX: { model: "taxComponent", label: "tax" },
} as const;

type ComponentKind = keyof typeof COMPONENT_KINDS;

function logComponentChange(
  tx: any,
  kind: ComponentKind,
  change: {
    countryId: string;
    componentId: string;
    changeType: "ADDED" | "MODIFIED" | "REMOVED";
    previous?: unknown;
    next: unknown;
    userId: string;
    verb: string;
    componentType: string;
  }
) {
  return tx.componentChangeLog.create({
    data: {
      countryId: change.countryId,
      componentType: kind,
      componentId: change.componentId,
      changeType: change.changeType,
      ...(change.previous !== undefined && { previousValue: JSON.stringify(change.previous) }),
      newValue: JSON.stringify(change.next),
      triggeredBy: change.userId,
      description: `${change.verb} ${COMPONENT_KINDS[kind].label} component: ${change.componentType}`,
    },
  });
}

function createComponentTx<T extends string>(
  kind: ComponentKind,
  db: PrismaClient | any,
  input: CreateComponentInput<T>,
  userId: string
) {
  return db.$transaction(async (tx: any) => {
    const component = await tx[COMPONENT_KINDS[kind].model].create({
      data: { ...input, implementationDate: new Date() },
    });

    await logComponentChange(tx, kind, {
      countryId: input.countryId,
      componentId: component.id,
      changeType: "ADDED",
      next: component,
      userId,
      verb: "Added",
      componentType: input.componentType,
    });

    return component;
  });
}

function updateComponentTx(
  kind: ComponentKind,
  db: PrismaClient | any,
  input: UpdateComponentInput,
  existing: any,
  userId: string
) {
  return db.$transaction(async (tx: any) => {
    const updated = await tx[COMPONENT_KINDS[kind].model].update({
      where: { id: input.id },
      data: {
        effectivenessScore: input.effectivenessScore,
        isActive: input.isActive,
        notes: input.notes,
      },
    });

    await logComponentChange(tx, kind, {
      countryId: existing.countryId,
      componentId: input.id,
      changeType: "MODIFIED",
      previous: existing,
      next: updated,
      userId,
      verb: "Updated",
      componentType: existing.componentType,
    });

    return updated;
  });
}

/** Soft-deletes a component (isActive = false) and logs the removal. */
async function deactivateComponent(tx: any, kind: ComponentKind, existing: any, userId: string) {
  const updated = await tx[COMPONENT_KINDS[kind].model].update({
    where: { id: existing.id },
    data: { isActive: false },
  });

  await logComponentChange(tx, kind, {
    countryId: existing.countryId,
    componentId: existing.id,
    changeType: "REMOVED",
    previous: existing,
    next: updated,
    userId,
    verb: "Removed",
    componentType: existing.componentType,
  });

  return updated;
}

function removeComponentTx(
  kind: ComponentKind,
  db: PrismaClient | any,
  id: string,
  existing: any,
  userId: string
) {
  return db.$transaction((tx: any) => deactivateComponent(tx, kind, { ...existing, id }, userId));
}

function bulkUpdateComponentsTx<T extends string>(
  kind: ComponentKind,
  db: PrismaClient | any,
  countryId: string,
  components: BulkComponentItem<T>[],
  userId: string
) {
  const model = COMPONENT_KINDS[kind].model;

  return db.$transaction(async (tx: any) => {
    const existing = await tx[model].findMany({ where: { countryId } });
    const existingMap = new Map(existing.map((comp: any) => [comp.componentType, comp]));
    const results = [];

    for (const componentData of components) {
      const existingComp = existingMap.get(componentData.componentType) as any;

      if (existingComp) {
        const updated = await tx[model].update({
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

        await logComponentChange(tx, kind, {
          countryId,
          componentId: existingComp.id,
          changeType: "MODIFIED",
          previous: existingComp,
          next: updated,
          userId,
          verb: "Updated",
          componentType: componentData.componentType,
        });

        results.push(updated);
      } else {
        const created = await tx[model].create({
          data: { countryId, ...componentData, implementationDate: new Date() },
        });

        await logComponentChange(tx, kind, {
          countryId,
          componentId: created.id,
          changeType: "ADDED",
          next: created,
          userId,
          verb: "Added",
          componentType: componentData.componentType,
        });

        results.push(created);
      }
    }

    const newTypes = new Set<string>(components.map((c) => c.componentType));
    for (const existingComp of existingMap.values() as Iterable<any>) {
      if (!newTypes.has(existingComp.componentType) && existingComp.isActive) {
        results.push(await deactivateComponent(tx, kind, existingComp, userId));
      }
    }

    return results;
  });
}

export const createEconomicComponentTx = (
  db: PrismaClient | any,
  input: CreateComponentInput<EconomicComponentType>,
  userId: string
) => createComponentTx("ECONOMIC", db, input, userId);

export const updateEconomicComponentTx = (
  db: PrismaClient | any,
  input: UpdateComponentInput,
  existing: any,
  userId: string
) => updateComponentTx("ECONOMIC", db, input, existing, userId);

export const removeEconomicComponentTx = (
  db: PrismaClient | any,
  id: string,
  existing: any,
  userId: string
) => removeComponentTx("ECONOMIC", db, id, existing, userId);

export const bulkUpdateEconomicComponentsTx = (
  db: PrismaClient | any,
  countryId: string,
  components: BulkComponentItem<EconomicComponentType>[],
  userId: string
) => bulkUpdateComponentsTx("ECONOMIC", db, countryId, components, userId);

export const createTaxComponentTx = (
  db: PrismaClient | any,
  input: CreateComponentInput<TaxComponentType>,
  userId: string
) => createComponentTx("TAX", db, input, userId);

export const updateTaxComponentTx = (
  db: PrismaClient | any,
  input: UpdateComponentInput,
  existing: any,
  userId: string
) => updateComponentTx("TAX", db, input, existing, userId);

export const removeTaxComponentTx = (
  db: PrismaClient | any,
  id: string,
  existing: any,
  userId: string
) => removeComponentTx("TAX", db, id, existing, userId);

export const bulkUpdateTaxComponentsTx = (
  db: PrismaClient | any,
  countryId: string,
  components: BulkComponentItem<TaxComponentType>[],
  userId: string
) => bulkUpdateComponentsTx("TAX", db, countryId, components, userId);

interface BudgetScenarioCategoryInput {
  categoryName: string;
  allocatedAmount: number;
  allocatedPercent: number;
  priority: "critical" | "high" | "medium" | "low";
  efficiency?: number;
  performance?: number;
}

interface CreateBudgetScenarioInput {
  countryId: string;
  name: string;
  description?: string;
  totalBudget: number;
  assumptions?: string;
  riskLevel: "low" | "medium" | "high";
  feasibility?: number;
  categories: BudgetScenarioCategoryInput[];
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
