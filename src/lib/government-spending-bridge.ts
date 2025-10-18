// src/lib/government-spending-bridge.ts

import type { GovernmentSpendingData } from '~/types/economics';
import type { GovernmentBuilderState, GovernmentStructure, DepartmentCategory } from '~/types/government';
import { createDefaultGovernmentSpendingData } from '~/lib/government-spending-defaults';

/**
 * Maps department categories to spending category icons and colors
 */
const DEPARTMENT_CATEGORY_MAP: Record<DepartmentCategory, {
  spendingCategory: string;
  icon: string;
  color: string;
  description: string;
}> = {
  'Defense': {
    spendingCategory: 'Defense & Security',
    icon: 'Shield',
    color: '#dc2626', // red-600
    description: 'Military, national security, and defense operations'
  },
  'Education': {
    spendingCategory: 'Education',
    icon: 'GraduationCap', 
    color: '#2563eb', // blue-600
    description: 'Schools, universities, and educational programs'
  },
  'Health': {
    spendingCategory: 'Healthcare',
    icon: 'Heart',
    color: '#059669', // emerald-600
    description: 'Public health services and medical programs'
  },
  'Finance': {
    spendingCategory: 'Government Operations',
    icon: 'Building',
    color: '#7c3aed', // violet-600
    description: 'Treasury, taxation, and financial administration'
  },
  'Foreign Affairs': {
    spendingCategory: 'Foreign Affairs',
    icon: 'Globe',
    color: '#0891b2', // cyan-600
    description: 'Diplomacy, embassies, and international relations'
  },
  'Interior': {
    spendingCategory: 'Interior & Law Enforcement',
    icon: 'Scale',
    color: '#dc2626', // red-600
    description: 'Domestic affairs, police, and internal security'
  },
  'Justice': {
    spendingCategory: 'Justice System',
    icon: 'Scale',
    color: '#7c2d12', // amber-800
    description: 'Courts, prisons, and legal system operations'
  },
  'Transportation': {
    spendingCategory: 'Infrastructure',
    icon: 'Truck',
    color: '#ea580c', // orange-600
    description: 'Roads, public transit, and transportation infrastructure'
  },
  'Agriculture': {
    spendingCategory: 'Agriculture & Rural Development',
    icon: 'Users2',
    color: '#65a30d', // lime-600
    description: 'Farming support, rural development, and food security'
  },
  'Environment': {
    spendingCategory: 'Environment & Energy',
    icon: 'Users2',
    color: '#059669', // emerald-600
    description: 'Environmental protection and sustainability programs'
  },
  'Labor': {
    spendingCategory: 'Social Safety Net',
    icon: 'Briefcase',
    color: '#0891b2', // cyan-600
    description: 'Employment services and worker protection'
  },
  'Commerce': {
    spendingCategory: 'Economic Development',
    icon: 'BarChart2',
    color: '#7c3aed', // violet-600
    description: 'Business support and economic development programs'
  },
  'Energy': {
    spendingCategory: 'Environment & Energy',
    icon: 'Users2',
    color: '#ea580c', // orange-600
    description: 'Energy production, regulation, and infrastructure'
  },
  'Communications': {
    spendingCategory: 'Technology & Communications',
    icon: 'Users2',
    color: '#2563eb', // blue-600
    description: 'Telecommunications, broadcasting, and digital services'
  },
  'Culture': {
    spendingCategory: 'Culture & Arts',
    icon: 'Users2',
    color: '#db2777', // pink-600
    description: 'Cultural programs, arts funding, and heritage preservation'
  },
  'Science and Technology': {
    spendingCategory: 'Research & Development',
    icon: 'Users2',
    color: '#7c3aed', // violet-600
    description: 'Scientific research and technology development'
  },
  'Social Services': {
    spendingCategory: 'Social Safety Net',
    icon: 'Heart',
    color: '#059669', // emerald-600
    description: 'Social welfare, benefits, and community services'
  },
  'Housing': {
    spendingCategory: 'Housing & Urban Development',
    icon: 'Building',
    color: '#ea580c', // orange-600
    description: 'Public housing and urban development programs'
  },
  'Veterans Affairs': {
    spendingCategory: 'Veterans Services',
    icon: 'Shield',
    color: '#dc2626', // red-600
    description: 'Services and benefits for military veterans'
  },
  'Intelligence': {
    spendingCategory: 'Intelligence & Security',
    icon: 'Shield',
    color: '#374151', // gray-700
    description: 'Intelligence gathering and national security'
  },
  'Emergency Management': {
    spendingCategory: 'Emergency Services',
    icon: 'Shield',
    color: '#dc2626', // red-600
    description: 'Disaster response and emergency preparedness'
  },
  'Other': {
    spendingCategory: 'Other Government Services',
    icon: 'MoreHorizontal',
    color: '#6b7280', // gray-500
    description: 'Miscellaneous government operations and services'
  }
};

/**
 * Converts government structure data into government spending data
 */
export function convertGovernmentStructureToSpending(
  governmentData: GovernmentBuilderState | GovernmentStructure,
  nominalGDP: number,
  totalPopulation: number
): GovernmentSpendingData {
  // Handle both builder state and saved structure
  const totalBudget = 'structure' in governmentData 
    ? governmentData.structure.totalBudget 
    : governmentData.totalBudget;
    
  const departments = ('departments' in governmentData && Array.isArray(governmentData.departments))
    ? governmentData.departments
    : [];
    
  const budgetAllocations = ('budgetAllocations' in governmentData && Array.isArray(governmentData.budgetAllocations))
    ? governmentData.budgetAllocations
    : [];

  // Group departments by spending category
  const categoryTotals = new Map<string, {
    amount: number;
    icon: string;
    color: string;
    description: string;
  }>();

  // Process department budget allocations
  if (budgetAllocations.length > 0) {
    budgetAllocations.forEach((allocation, index) => {
      const department = departments.find((d, dIndex) =>
        ('id' in d ? d.id === allocation.departmentId : false) ||
        dIndex === index
      );

      if (department && 'category' in department && department.category) {
        const category = department.category as DepartmentCategory;
        const categoryInfo = DEPARTMENT_CATEGORY_MAP[category];
        if (categoryInfo) {
          const existingCategory = categoryTotals.get(categoryInfo.spendingCategory);

          categoryTotals.set(categoryInfo.spendingCategory, {
            amount: (existingCategory?.amount || 0) + allocation.allocatedAmount,
            icon: categoryInfo.icon,
            color: categoryInfo.color,
            description: categoryInfo.description
          });
        }
      }
    });
  } else {
    // Fallback: If no budget allocations, distribute budget equally among departments
    const budgetPerDepartment = departments.length > 0 ? totalBudget / departments.length : 0;
    
    departments.forEach(department => {
      if ('category' in department && department.category) {
        const category = department.category as DepartmentCategory;
        const categoryInfo = DEPARTMENT_CATEGORY_MAP[category];
        const existingCategory = categoryTotals.get(categoryInfo.spendingCategory);

        categoryTotals.set(categoryInfo.spendingCategory, {
          amount: (existingCategory?.amount || 0) + budgetPerDepartment,
          icon: categoryInfo.icon,
          color: categoryInfo.color,
          description: categoryInfo.description
        });
      }
    });
  }

  // Convert to spending categories array
  const spendingCategories = Array.from(categoryTotals.entries()).map(([category, data]) => ({
    category,
    amount: data.amount,
    percent: totalBudget > 0 ? (data.amount / totalBudget) * 100 : 0,
    icon: data.icon,
    color: data.color,
    description: data.description
  }));

  // Calculate specific category amounts for backward compatibility
  const getCategoryAmount = (categoryName: string): number => {
    const category = spendingCategories.find(c => 
      c.category.toLowerCase().includes(categoryName.toLowerCase())
    );
    return category?.amount || 0;
  };

  const education = getCategoryAmount('education');
  const healthcare = getCategoryAmount('health');
  const socialSafety = getCategoryAmount('social');

  // Calculate fiscal metrics
  const spendingGDPPercent = nominalGDP > 0 ? (totalBudget / nominalGDP) * 100 : 0;
  const spendingPerCapita = totalPopulation > 0 ? totalBudget / totalPopulation : 0;
  
  // Assume balanced budget for now - could be enhanced to include revenue data
  const deficitSurplus = 0; // totalRevenue - totalBudget (would need revenue calculation)

  return createDefaultGovernmentSpendingData({
    education,
    healthcare,
    socialSafety,
    totalSpending: totalBudget,
    spendingGDPPercent,
    spendingPerCapita,
    deficitSurplus,
    spendingCategories,
  });
}

/**
 * Checks if government data should override spending data
 */
export function shouldUseGovernmentStructureData(governmentData: GovernmentBuilderState | GovernmentStructure | null): boolean {
  if (!governmentData) return false;
  
  const departments = 'departments' in governmentData ? governmentData.departments : [];
  const totalBudget = 'structure' in governmentData 
    ? governmentData.structure.totalBudget 
    : governmentData.totalBudget;
    
  return departments.length > 0 && totalBudget > 0;
}

/**
 * Creates a hybrid spending system that prioritizes government structure when available
 */
export function createHybridSpendingData(
  currentSpendingData: GovernmentSpendingData,
  governmentData: GovernmentBuilderState | GovernmentStructure | null,
  nominalGDP: number,
  totalPopulation: number
): GovernmentSpendingData {
  if (governmentData && shouldUseGovernmentStructureData(governmentData)) {
    return convertGovernmentStructureToSpending(governmentData, nominalGDP, totalPopulation);
  }

  return currentSpendingData;
}