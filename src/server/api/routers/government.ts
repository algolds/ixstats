// src/server/api/routers/government.ts

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { COMPONENT_TYPE_VALUES } from "~/types/government";

// Input validation schemas
const governmentStructureInputSchema = z.object({
  governmentName: z.string().min(1, "Government name is required"),
  governmentType: z.enum([
    'Constitutional Monarchy',
    'Federal Republic', 
    'Parliamentary Democracy',
    'Presidential Republic',
    'Federal Constitutional Republic',
    'Unitary State',
    'Federation',
    'Confederation',
    'Empire',
    'City-State',
    'Other'
  ]),
  headOfState: z.string().optional(),
  headOfGovernment: z.string().optional(),
  legislatureName: z.string().optional(),
  executiveName: z.string().optional(),
  judicialName: z.string().optional(),
  totalBudget: z.number().positive("Total budget must be positive"),
  fiscalYear: z.string().default("Calendar Year"),
  budgetCurrency: z.string().default("USD"),
});

const departmentInputSchema = z.object({
  name: z.string().min(1, "Department name is required"),
  shortName: z.string().optional(),
  category: z.enum([
    'Defense', 'Education', 'Health', 'Finance', 'Foreign Affairs', 'Interior',
    'Justice', 'Transportation', 'Agriculture', 'Environment', 'Labor', 'Commerce',
    'Energy', 'Communications', 'Culture', 'Science and Technology', 'Social Services',
    'Housing', 'Veterans Affairs', 'Intelligence', 'Emergency Management', 'Other'
  ]),
  description: z.string().optional(),
  minister: z.string().optional(),
  ministerTitle: z.string().default("Minister"),
  headquarters: z.string().optional(),
  established: z.string().optional(),
  employeeCount: z.number().int().positive().optional(),
  icon: z.string().optional(),
  color: z.string().default("#6366f1"),
  priority: z.number().int().min(1).max(100).default(50),
  parentDepartmentId: z.string().optional(),
  organizationalLevel: z.enum(['Ministry', 'Department', 'Agency', 'Bureau', 'Office', 'Commission']).default("Ministry"),
  functions: z.array(z.string()).optional(),
});

const budgetAllocationInputSchema = z.object({
  departmentId: z.string().min(1),
  budgetYear: z.number().int().min(2020).max(2030),
  allocatedAmount: z.number().nonnegative(),
  allocatedPercent: z.number().min(0).max(100),
  notes: z.string().optional(),
});

const subBudgetInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  amount: z.number().nonnegative(),
  percent: z.number().min(0).max(100),
  budgetType: z.enum(['Personnel', 'Operations', 'Capital', 'Research', 'Other']),
  isRecurring: z.boolean().default(true),
  priority: z.enum(['Critical', 'High', 'Medium', 'Low']).default('Medium'),
});

const revenueSourceInputSchema = z.object({
  name: z.string().min(1),
  category: z.enum(['Direct Tax', 'Indirect Tax', 'Non-Tax Revenue', 'Fees and Fines', 'Other']),
  description: z.string().optional(),
  rate: z.number().min(0).max(100).optional(),
  revenueAmount: z.number().nonnegative(),
  collectionMethod: z.string().optional(),
  administeredBy: z.string().optional(),
});

const governmentBuilderStateSchema = z.object({
  structure: governmentStructureInputSchema,
  departments: z.array(departmentInputSchema),
  budgetAllocations: z.array(budgetAllocationInputSchema),
  revenueSources: z.array(revenueSourceInputSchema),
});

export const governmentRouter = createTRPCRouter({
  // Get government structure by country ID
  getByCountryId: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const governmentStructure = await ctx.db.governmentStructure.findUnique({
        where: { countryId: input.countryId },
        include: {
          departments: {
            include: {
              subDepartments: true,
              budgetAllocations: {
                orderBy: { budgetYear: 'desc' }
              },
              subBudgets: true,
            },
            orderBy: { priority: 'desc' }
          },
          budgetAllocations: {
            include: { department: true },
            orderBy: { budgetYear: 'desc' }
          },
          revenueSources: {
            where: { isActive: true },
            orderBy: { revenueAmount: 'desc' }
          }
        }
      });

      if (!governmentStructure) {
        return null;
      }

      return governmentStructure;
    }),

  // Create complete government structure
  create: publicProcedure
    .input(z.object({ 
      countryId: z.string(),
      data: governmentBuilderStateSchema 
    }))
    .mutation(async ({ ctx, input }) => {
      const { countryId, data } = input;

      // Check if government structure already exists
      const existing = await ctx.db.governmentStructure.findUnique({
        where: { countryId }
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Government structure already exists for this country'
        });
      }

      // Create in transaction
      const result = await ctx.db.$transaction(async (tx) => {
        // Create government structure
        const governmentStructure = await tx.governmentStructure.create({
          data: {
            countryId,
            ...data.structure,
          }
        });

        // Create departments
        const departmentIdMap = new Map<number, string>();
        const departments = [];

        for (let i = 0; i < data.departments.length; i++) {
          const deptData = data.departments[i]!;
          const department = await tx.governmentDepartment.create({
            data: {
              governmentStructureId: governmentStructure.id,
              name: deptData.name,
              shortName: deptData.shortName,
              category: deptData.category,
              description: deptData.description,
              minister: deptData.minister,
              ministerTitle: deptData.ministerTitle,
              headquarters: deptData.headquarters,
              established: deptData.established,
              employeeCount: deptData.employeeCount,
              icon: deptData.icon,
              color: deptData.color,
              priority: deptData.priority,
              organizationalLevel: deptData.organizationalLevel,
              functions: deptData.functions ? JSON.stringify(deptData.functions) : null,
            }
          });
          
          departmentIdMap.set(i, department.id);
          departments.push(department);
        }

        // Update parent department relationships
        for (let i = 0; i < data.departments.length; i++) {
          const deptData = data.departments[i]!;
          if (deptData.parentDepartmentId) {
            const parentIndex = parseInt(deptData.parentDepartmentId);
            const parentId = departmentIdMap.get(parentIndex);
            const currentId = departmentIdMap.get(i);
            
            if (parentId && currentId) {
              await tx.governmentDepartment.update({
                where: { id: currentId },
                data: { parentDepartmentId: parentId }
              });
            }
          }
        }

        // Create budget allocations
        for (const allocation of data.budgetAllocations) {
          const departmentIndex = parseInt(allocation.departmentId);
          const departmentId = departmentIdMap.get(departmentIndex);
          
          if (departmentId) {
            await tx.budgetAllocation.create({
              data: {
                governmentStructureId: governmentStructure.id,
                departmentId,
                budgetYear: allocation.budgetYear,
                allocatedAmount: allocation.allocatedAmount,
                allocatedPercent: allocation.allocatedPercent,
                availableAmount: allocation.allocatedAmount, // Initially all available
                notes: allocation.notes,
              }
            });
          }
        }

        // Create revenue sources
        for (const revenueSource of data.revenueSources) {
          await tx.revenueSource.create({
            data: {
              governmentStructureId: governmentStructure.id,
              name: revenueSource.name,
              category: revenueSource.category,
              description: revenueSource.description,
              rate: revenueSource.rate,
              revenueAmount: revenueSource.revenueAmount,
              revenuePercent: data.structure.totalBudget > 0 
                ? (revenueSource.revenueAmount / data.structure.totalBudget) * 100 
                : 0,
              collectionMethod: revenueSource.collectionMethod,
              administeredBy: revenueSource.administeredBy,
            }
          });
        }

        return governmentStructure;
      });

      return result;
    }),

  // Update government structure
  update: publicProcedure
    .input(z.object({
      countryId: z.string(),
      data: governmentBuilderStateSchema
    }))
    .mutation(async ({ ctx, input }) => {
      const { countryId, data } = input;

      const result = await ctx.db.$transaction(async (tx) => {
        // Update government structure
        const governmentStructure = await tx.governmentStructure.update({
          where: { countryId },
          data: data.structure
        });

        // Delete existing related data
        await tx.budgetAllocation.deleteMany({
          where: { governmentStructureId: governmentStructure.id }
        });
        await tx.revenueSource.deleteMany({
          where: { governmentStructureId: governmentStructure.id }
        });
        await tx.governmentDepartment.deleteMany({
          where: { governmentStructureId: governmentStructure.id }
        });

        // Recreate departments and related data (same logic as create)
        const departmentIdMap = new Map<number, string>();
        
        for (let i = 0; i < data.departments.length; i++) {
          const deptData = data.departments[i]!;
          const department = await tx.governmentDepartment.create({
            data: {
              governmentStructureId: governmentStructure.id,
              name: deptData.name,
              shortName: deptData.shortName,
              category: deptData.category,
              description: deptData.description,
              minister: deptData.minister,
              ministerTitle: deptData.ministerTitle,
              headquarters: deptData.headquarters,
              established: deptData.established,
              employeeCount: deptData.employeeCount,
              icon: deptData.icon,
              color: deptData.color,
              priority: deptData.priority,
              organizationalLevel: deptData.organizationalLevel,
              functions: deptData.functions ? JSON.stringify(deptData.functions) : null,
            }
          });
          
          departmentIdMap.set(i, department.id);
        }

        // Update parent relationships
        for (let i = 0; i < data.departments.length; i++) {
          const deptData = data.departments[i]!;
          if (deptData.parentDepartmentId) {
            const parentIndex = parseInt(deptData.parentDepartmentId);
            const parentId = departmentIdMap.get(parentIndex);
            const currentId = departmentIdMap.get(i);
            
            if (parentId && currentId) {
              await tx.governmentDepartment.update({
                where: { id: currentId },
                data: { parentDepartmentId: parentId }
              });
            }
          }
        }

        // Recreate budget allocations
        for (const allocation of data.budgetAllocations) {
          const departmentIndex = parseInt(allocation.departmentId);
          const departmentId = departmentIdMap.get(departmentIndex);
          
          if (departmentId) {
            await tx.budgetAllocation.create({
              data: {
                governmentStructureId: governmentStructure.id,
                departmentId,
                budgetYear: allocation.budgetYear,
                allocatedAmount: allocation.allocatedAmount,
                allocatedPercent: allocation.allocatedPercent,
                availableAmount: allocation.allocatedAmount,
                notes: allocation.notes,
              }
            });
          }
        }

        // Recreate revenue sources
        for (const revenueSource of data.revenueSources) {
          await tx.revenueSource.create({
            data: {
              governmentStructureId: governmentStructure.id,
              name: revenueSource.name,
              category: revenueSource.category,
              description: revenueSource.description,
              rate: revenueSource.rate,
              revenueAmount: revenueSource.revenueAmount,
              revenuePercent: data.structure.totalBudget > 0 
                ? (revenueSource.revenueAmount / data.structure.totalBudget) * 100 
                : 0,
              collectionMethod: revenueSource.collectionMethod,
              administeredBy: revenueSource.administeredBy,
            }
          });
        }

        return governmentStructure;
      });

      return result;
    }),

  // Delete government structure
  delete: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.db.governmentStructure.delete({
        where: { countryId: input.countryId }
      });

      return { success: true, id: deleted.id };
    }),

  // Get budget summary
  getBudgetSummary: publicProcedure
    .input(z.object({ 
      countryId: z.string(),
      budgetYear: z.number().int().optional()
    }))
    .query(async ({ ctx, input }) => {
      const currentYear = input.budgetYear || new Date().getFullYear();
      
      const governmentStructure = await ctx.db.governmentStructure.findUnique({
        where: { countryId: input.countryId },
        include: {
          departments: {
            include: {
              budgetAllocations: {
                where: { budgetYear: currentYear }
              }
            }
          },
          budgetAllocations: {
            where: { budgetYear: currentYear },
            include: { department: true }
          }
        }
      });

      if (!governmentStructure) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Government structure not found'
        });
      }

      const totalAllocated = governmentStructure.budgetAllocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
      const totalSpent = governmentStructure.budgetAllocations.reduce((sum, a) => sum + a.spentAmount, 0);
      const totalAvailable = totalAllocated - totalSpent;
      const utilizationRate = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;

      const topSpendingDepartments = governmentStructure.budgetAllocations
        .map(allocation => ({
          department: allocation.department,
          allocation
        }))
        .sort((a, b) => b.allocation.allocatedAmount - a.allocation.allocatedAmount)
        .slice(0, 5);

      return {
        totalBudget: governmentStructure.totalBudget,
        totalAllocated,
        totalSpent,
        totalAvailable,
        utilizationRate,
        departmentCount: governmentStructure.departments.length,
        topSpendingDepartments
      };
    }),

  // Get revenue summary
  getRevenueSummary: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const revenueSources = await ctx.db.revenueSource.findMany({
        where: { 
          governmentStructure: { countryId: input.countryId },
          isActive: true 
        },
        orderBy: { revenueAmount: 'desc' }
      });

      const totalRevenue = revenueSources.reduce((sum, r) => sum + r.revenueAmount, 0);
      const totalTaxRevenue = revenueSources
        .filter(r => r.category.includes('Tax'))
        .reduce((sum, r) => sum + r.revenueAmount, 0);
      const totalNonTaxRevenue = totalRevenue - totalTaxRevenue;

      const revenueCategories = ['Direct Tax', 'Indirect Tax', 'Non-Tax Revenue', 'Fees and Fines', 'Other'] as const;
      const revenueBreakdown = revenueCategories.map(category => {
        const amount = revenueSources
          .filter(r => r.category === category)
          .reduce((sum, r) => sum + r.revenueAmount, 0);
        return {
          category,
          amount,
          percent: totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0
        };
      }).filter(item => item.amount > 0);

      const topRevenueSources = revenueSources.slice(0, 5);

      return {
        totalRevenue,
        totalTaxRevenue,
        totalNonTaxRevenue,
        revenueBreakdown,
        topRevenueSources
      };
    }),

  // Update budget allocation
  updateBudgetAllocation: publicProcedure
    .input(z.object({
      allocationId: z.string(),
      data: z.object({
        allocatedAmount: z.number().nonnegative().optional(),
        allocatedPercent: z.number().min(0).max(100).optional(),
        spentAmount: z.number().nonnegative().optional(),
        encumberedAmount: z.number().nonnegative().optional(),
        notes: z.string().optional()
      })
    }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.budgetAllocation.update({
        where: { id: input.allocationId },
        data: {
          ...input.data,
          availableAmount: input.data.allocatedAmount !== undefined
            ? input.data.allocatedAmount - (input.data.spentAmount || 0) - (input.data.encumberedAmount || 0)
            : undefined,
          lastReviewed: new Date()
        }
      });

      return updated;
    }),

  // Add sub-budget categories
  addSubBudget: publicProcedure
    .input(z.object({
      departmentId: z.string(),
      data: subBudgetInputSchema
    }))
    .mutation(async ({ ctx, input }) => {
      const subBudget = await ctx.db.subBudgetCategory.create({
        data: {
          departmentId: input.departmentId,
          ...input.data
        }
      });

      return subBudget;
    }),

  // Get department hierarchy
  getDepartmentHierarchy: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const governmentStructure = await ctx.db.governmentStructure.findUnique({
        where: { countryId: input.countryId },
        include: {
          departments: {
            include: {
              subDepartments: {
                include: {
                  subDepartments: true, // Get nested departments
                  budgetAllocations: true
                }
              },
              budgetAllocations: true
            },
            where: { parentDepartmentId: null }, // Only top-level departments
            orderBy: { priority: 'desc' }
          }
        }
      });

      if (!governmentStructure) {
        return [];
      }

      // Build hierarchy recursively
      const buildHierarchy = (department: any): any => {
        const totalBudget = department.budgetAllocations.reduce((sum: number, a: any) => sum + a.allocatedAmount, 0);
        const totalEmployees = (department.employeeCount || 0) + 
          department.subDepartments.reduce((sum: number, sub: any) => sum + (sub.employeeCount || 0), 0);

        return {
          department,
          children: department.subDepartments.map(buildHierarchy),
          totalBudget,
          totalEmployees
        };
      };

      return governmentStructure.departments.map(buildHierarchy);
    }),

  // Get atomic government components for a country
  getComponents: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const components = await ctx.db.governmentComponent.findMany({
        where: { countryId: input.countryId },
        include: {
          synergies: {
            include: {
              secondaryComponent: true
            }
          },
          conflictsWith: {
            include: {
              primaryComponent: true
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      });

      return components;
    }),

  // Add atomic government component
  addComponent: publicProcedure
    .input(z.object({
      countryId: z.string(),
      componentType: z.enum(COMPONENT_TYPE_VALUES),
      isActive: z.boolean().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if component already exists
      const existing = await ctx.db.governmentComponent.findFirst({
        where: {
          countryId: input.countryId,
          componentType: input.componentType
        }
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'This component is already selected'
        });
      }

      const component = await ctx.db.governmentComponent.create({
        data: {
          countryId: input.countryId,
          componentType: input.componentType,
          isActive: input.isActive ?? true
        }
      });

      return component;
    }),

  // Remove atomic government component
  removeComponent: publicProcedure
    .input(z.object({
      countryId: z.string(),
      componentType: z.enum(COMPONENT_TYPE_VALUES)
    }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.db.governmentComponent.deleteMany({
        where: {
          countryId: input.countryId,
          componentType: input.componentType
        }
      });

      return { success: deleted.count > 0 };
    }),

  // Get effectiveness analysis for atomic components
  getEffectivenesAnalysis: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const components = await ctx.db.governmentComponent.findMany({
        where: { 
          countryId: input.countryId,
          isActive: true
        },
        include: {
          synergies: {
            include: {
              secondaryComponent: true
            }
          },
          conflictsWith: {
            include: {
              primaryComponent: true
            }
          }
        }
      });

      // Calculate overall effectiveness score
      let totalScore = 0;
      let synergyBonus = 0;
      let conflictPenalty = 0;

      for (const component of components) {
        // Use the actual effectiveness score from the component
        totalScore += component.effectivenessScore;
        
        // Add synergy bonuses
        const activeSynergies = component.synergies.filter(
          s => s.synergyType === 'SYNERGY' && s.secondaryComponent.isActive
        );
        synergyBonus += activeSynergies.length * 5;

        // Subtract conflict penalties  
        const activeConflicts = component.conflictsWith.filter(
          s => s.synergyType === 'CONFLICT' && s.primaryComponent.isActive
        );
        conflictPenalty += activeConflicts.length * 10;
      }

      const averageScore = components.length > 0 ? totalScore / components.length : 0;
      const finalScore = Math.max(0, Math.min(100, averageScore + synergyBonus - conflictPenalty));

      return {
        overallEffectiveness: finalScore,
        componentCount: components.length,
        synergyBonus,
        conflictPenalty,
        components: components.map(c => ({
          componentType: c.componentType,
          isActive: c.isActive,
          effectivenessScore: c.effectivenessScore
        }))
      };
    }),
});