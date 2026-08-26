/**
 * Demo seed for government structure, departments, components, and tax system.
 */

import { type PrismaClient } from "@prisma/client";

type Prisma = PrismaClient;

export async function seedGovernmentTree(
  prisma: Prisma,
  countryId: string,
  governmentStructureId: string
): Promise<number> {
  let count = 0;

  const departments = [
    {
      name: "Ministry of Finance",
      shortName: "MoF",
      category: "economic",
      minister: "Alexandra Petrova",
      color: "#059669",
      priority: 10,
      description: "Responsible for fiscal policy, taxation, and public finance management.",
      icon: "💰",
    },
    {
      name: "Ministry of Defense",
      shortName: "MoD",
      category: "defense",
      minister: "General Marcus Thorne",
      color: "#dc2626",
      priority: 20,
      description: "National defense, military operations, and strategic security.",
      icon: "🛡️",
    },
    {
      name: "Ministry of Foreign Affairs",
      shortName: "MFA",
      category: "diplomacy",
      minister: "Isabella Fontaine",
      color: "#2563eb",
      priority: 30,
      description: "International relations, diplomatic missions, and foreign policy.",
      icon: "🌐",
    },
    {
      name: "Ministry of Health",
      shortName: "MoH",
      category: "social",
      minister: "Dr. Samuel Chen",
      color: "#7c3aed",
      priority: 40,
      description: "Public health, hospitals, and healthcare regulation.",
      icon: "🏥",
    },
    {
      name: "Ministry of Education",
      shortName: "MoE",
      category: "social",
      minister: "Prof. Maria Santos",
      color: "#0891b2",
      priority: 50,
      description: "Education policy, schools, universities, and research funding.",
      icon: "🎓",
    },
    {
      name: "Ministry of Infrastructure",
      shortName: "MoI",
      category: "infrastructure",
      minister: "Viktor Andersen",
      color: "#d97706",
      priority: 60,
      description: "Transportation, utilities, and public infrastructure projects.",
      icon: "🏗️",
    },
    {
      name: "Ministry of Justice",
      shortName: "MoJ",
      category: "governance",
      minister: "Justice Elena Varga",
      color: "#4f46e5",
      priority: 70,
      description: "Law enforcement, courts, and the judicial system.",
      icon: "⚖️",
    },
    {
      name: "Ministry of Commerce",
      shortName: "MoC",
      category: "economic",
      minister: "Robert Kingsley",
      color: "#0d9488",
      priority: 80,
      description: "Trade, industry regulation, and economic development.",
      icon: "📊",
    },
  ];

  const deptIds: string[] = [];
  for (const dept of departments) {
    const created = await prisma.governmentDepartment.create({
      data: { governmentStructureId, ...dept },
    });
    deptIds.push(created.id);
    count++;
  }

  // Add officials for first 4 departments
  const officials = [
    {
      governmentStructureId,
      departmentId: deptIds[0],
      name: "Alexandra Petrova",
      title: "Minister of Finance",
      role: "minister",
      bio: "Former central bank governor with 20 years of fiscal policy experience.",
      priority: 10,
    },
    {
      governmentStructureId,
      departmentId: deptIds[0],
      name: "Thomas Richter",
      title: "Deputy Minister of Finance",
      role: "deputy_minister",
      bio: "Tax reform specialist and public finance expert.",
      priority: 20,
    },
    {
      governmentStructureId,
      departmentId: deptIds[1],
      name: "General Marcus Thorne",
      title: "Minister of Defense",
      role: "minister",
      bio: "Distinguished military career spanning 30 years. Former Joint Chiefs chairman.",
      priority: 10,
    },
    {
      governmentStructureId,
      departmentId: deptIds[2],
      name: "Isabella Fontaine",
      title: "Minister of Foreign Affairs",
      role: "minister",
      bio: "Career diplomat with ambassadorial experience in 4 nations.",
      priority: 10,
    },
    {
      governmentStructureId,
      departmentId: deptIds[3],
      name: "Dr. Samuel Chen",
      title: "Minister of Health",
      role: "minister",
      bio: "Leading epidemiologist and public health policy architect.",
      priority: 10,
    },
  ];
  for (const official of officials) {
    await (prisma as any).governmentOfficial.create({ data: official });
    count++;
  }

  // Budget allocations for each department
  const budgetYear = new Date().getFullYear();
  const budgets = [
    { departmentId: deptIds[0]!, allocatedAmount: 85000000000, allocatedPercent: 22 },
    { departmentId: deptIds[1]!, allocatedAmount: 58000000000, allocatedPercent: 15 },
    { departmentId: deptIds[2]!, allocatedAmount: 12000000000, allocatedPercent: 3 },
    { departmentId: deptIds[3]!, allocatedAmount: 78000000000, allocatedPercent: 20 },
    { departmentId: deptIds[4]!, allocatedAmount: 54000000000, allocatedPercent: 14 },
    { departmentId: deptIds[5]!, allocatedAmount: 31000000000, allocatedPercent: 8 },
    { departmentId: deptIds[6]!, allocatedAmount: 23000000000, allocatedPercent: 6 },
    { departmentId: deptIds[7]!, allocatedAmount: 19000000000, allocatedPercent: 5 },
  ];
  for (const budget of budgets) {
    await (prisma as any).budgetAllocation.create({
      data: { governmentStructureId, budgetYear, budgetStatus: "Allocated", ...budget },
    });
    count++;
  }

  // Revenue sources
  const revenueSources = [
    {
      name: "Personal Income Tax",
      category: "direct_tax",
      rate: 25,
      revenueAmount: 120000000000,
      revenuePercent: 38,
    },
    {
      name: "Corporate Tax",
      category: "direct_tax",
      rate: 21,
      revenueAmount: 65000000000,
      revenuePercent: 21,
    },
    {
      name: "Sales Tax / VAT",
      category: "indirect_tax",
      rate: 8.5,
      revenueAmount: 52000000000,
      revenuePercent: 16,
    },
    {
      name: "Payroll Tax",
      category: "direct_tax",
      rate: 7.65,
      revenueAmount: 42000000000,
      revenuePercent: 13,
    },
    {
      name: "Property Tax",
      category: "direct_tax",
      rate: 1.2,
      revenueAmount: 18000000000,
      revenuePercent: 6,
    },
    {
      name: "Excise Duties",
      category: "indirect_tax",
      rate: null,
      revenueAmount: 12000000000,
      revenuePercent: 4,
    },
    {
      name: "Other Revenue",
      category: "non_tax",
      rate: null,
      revenueAmount: 6000000000,
      revenuePercent: 2,
    },
  ];
  for (const rev of revenueSources) {
    await (prisma as any).revenueSource.create({
      data: { governmentStructureId, isActive: true, ...rev },
    });
    count++;
  }

  return count;
}

// ─── Government / Economic / Tax Components ──────────────────────

export async function seedGovernmentComponents(prisma: Prisma, countryId: string): Promise<number> {
  let count = 0;

  const govComponents = [
    { componentType: "CENTRALIZED_POWER", effectivenessScore: 72 },
    { componentType: "DEMOCRATIC_PROCESS", effectivenessScore: 68 },
    { componentType: "INDEPENDENT_JUDICIARY", effectivenessScore: 75 },
    { componentType: "PROFESSIONAL_BUREAUCRACY", effectivenessScore: 70 },
    { componentType: "ELECTORAL_LEGITIMACY", effectivenessScore: 65 },
  ];

  const govCompIds: string[] = [];
  for (const comp of govComponents) {
    const created = await prisma.governmentComponent.create({
      data: { countryId, isActive: true, ...comp } as any,
    });
    govCompIds.push(created.id);
    count++;
  }

  // Add synergies between complementary components
  if (govCompIds.length >= 3) {
    await prisma.componentSynergy.create({
      data: {
        countryId,
        primaryComponentId: govCompIds[0]!,
        secondaryComponentId: govCompIds[2]!,
        synergyType: "checks_and_balances",
        effectMultiplier: 1.15,
        description: "Executive-Judicial checks and balances improve governance quality.",
      },
    });
    count++;
  }

  // Economic components
  const econComponents = [
    { componentType: "MIXED_ECONOMY", effectivenessScore: 74 },
    { componentType: "EXPORT_ORIENTED", effectivenessScore: 68 },
    { componentType: "SERVICE_BASED", effectivenessScore: 62 },
  ];
  for (const comp of econComponents) {
    await prisma.economicComponent.create({
      data: { countryId, isActive: true, ...comp } as any,
    });
    count++;
  }

  // Tax components
  const taxComponents = [
    { componentType: "PROGRESSIVE_TAX", effectivenessScore: 71 },
    { componentType: "CORPORATE_TAX", effectivenessScore: 66 },
    { componentType: "SALES_TAX", effectivenessScore: 78 },
  ];
  for (const comp of taxComponents) {
    await prisma.taxComponent.create({
      data: { countryId, isActive: true, ...comp } as any,
    });
    count++;
  }

  return count;
}

// ─── Tax Tree ──────────────────────────────────────────────────────

export async function seedTaxTree(prisma: Prisma, countryId: string): Promise<number> {
  let count = 0;

  // TaxSystem (1:1)
  const taxSystem = await prisma.taxSystem.create({
    data: {
      countryId,
      taxSystemName: "National Revenue Service",
      taxAuthority: "Department of Revenue",
      fiscalYear: "calendar",
      progressiveTax: true,
      complianceRate: 92,
      collectionEfficiency: 87,
    },
  });
  count++;

  // TaxCategory: Personal Income
  const incomeCat = await prisma.taxCategory.create({
    data: {
      taxSystemId: taxSystem.id,
      categoryName: "Personal Income Tax",
      categoryType: "income",
      description: "Progressive tax on individual earned and investment income.",
      isActive: true,
      baseRate: 25,
      calculationMethod: "progressive",
      deductionAllowed: true,
      standardDeduction: 15000,
      priority: 10,
      color: "#059669",
    },
  });
  count++;

  // Income tax brackets
  const brackets = [
    { bracketName: "Exempt", minIncome: 0, maxIncome: 15000, rate: 0, priority: 10 },
    { bracketName: "Low", minIncome: 15001, maxIncome: 45000, rate: 15, priority: 20 },
    { bracketName: "Middle", minIncome: 45001, maxIncome: 120000, rate: 25, priority: 30 },
    { bracketName: "Upper", minIncome: 120001, maxIncome: 250000, rate: 33, priority: 40 },
    { bracketName: "Top", minIncome: 250001, maxIncome: null, rate: 39, priority: 50 },
  ];
  for (const bracket of brackets) {
    await prisma.taxBracket.create({
      data: {
        taxSystemId: taxSystem.id,
        categoryId: incomeCat.id,
        marginalRate: true,
        isActive: true,
        ...bracket,
      },
    });
    count++;
  }

  // TaxCategory: Corporate
  const corpCat = await prisma.taxCategory.create({
    data: {
      taxSystemId: taxSystem.id,
      categoryName: "Corporate Tax",
      categoryType: "corporate",
      description: "Tax on business profits and corporate income.",
      isActive: true,
      baseRate: 21,
      calculationMethod: "flat",
      deductionAllowed: true,
      priority: 20,
      color: "#2563eb",
    },
  });
  count++;

  await prisma.taxBracket.create({
    data: {
      taxSystemId: taxSystem.id,
      categoryId: corpCat.id,
      bracketName: "Standard Rate",
      minIncome: 0,
      rate: 21,
      marginalRate: false,
      isActive: true,
      priority: 10,
    },
  });
  count++;

  // TaxCategory: Sales
  const salesCat = await prisma.taxCategory.create({
    data: {
      taxSystemId: taxSystem.id,
      categoryName: "Sales Tax / VAT",
      categoryType: "consumption",
      description: "Tax on goods and services at point of sale.",
      isActive: true,
      baseRate: 8.5,
      calculationMethod: "percentage",
      deductionAllowed: false,
      priority: 30,
      color: "#d97706",
    },
  });
  count++;

  // Exemptions
  const exemptions = [
    {
      exemptionName: "Standard Personal Deduction",
      exemptionType: "personal",
      description: "Base income exempt from taxation.",
      exemptionAmount: 15000,
    },
    {
      exemptionName: "Charitable Donations",
      exemptionType: "deduction",
      description: "Deduction for verified charitable contributions.",
      exemptionRate: 100,
    },
    {
      exemptionName: "Medical Expenses",
      exemptionType: "deduction",
      description: "Deduction for out-of-pocket medical costs exceeding 7.5% of income.",
      exemptionRate: 100,
    },
  ];
  for (const ex of exemptions) {
    await prisma.taxExemption.create({
      data: { taxSystemId: taxSystem.id, categoryId: incomeCat.id, isActive: true, ...ex },
    });
    count++;
  }

  // TaxDeductions — Personal Income
  const personalDeductions = [
    {
      categoryId: incomeCat.id,
      deductionName: "Charitable Donations",
      deductionType: "charitable",
      description: "Deduction for verified charitable contributions.",
      percentage: 100,
      isActive: true,
      priority: 10,
    },
    {
      categoryId: incomeCat.id,
      deductionName: "Mortgage Interest",
      deductionType: "housing",
      description: "Deduction for primary residence mortgage interest.",
      maximumAmount: 750000,
      isActive: true,
      priority: 20,
    },
    {
      categoryId: incomeCat.id,
      deductionName: "Medical Expenses",
      deductionType: "medical",
      description: "Deduction for out-of-pocket medical costs exceeding 7.5% of income.",
      percentage: 100,
      isActive: true,
      priority: 30,
    },
    {
      categoryId: incomeCat.id,
      deductionName: "Education Expenses",
      deductionType: "education",
      description: "Deduction for qualifying tuition and educational materials.",
      maximumAmount: 10000,
      isActive: true,
      priority: 40,
    },
  ];
  await prisma.taxDeduction.createMany({ data: personalDeductions });
  count += personalDeductions.length;

  // TaxDeductions — Corporate
  const corporateDeductions = [
    {
      categoryId: corpCat.id,
      deductionName: "Business Expenses",
      deductionType: "operational",
      description: "Standard deduction for legitimate business operating costs.",
      percentage: 100,
      isActive: true,
      priority: 10,
    },
    {
      categoryId: corpCat.id,
      deductionName: "R&D Tax Credit",
      deductionType: "research",
      description: "Tax credit for qualifying research and development expenditures.",
      percentage: 20,
      isActive: true,
      priority: 20,
    },
  ];
  await prisma.taxDeduction.createMany({ data: corporateDeductions });
  count += corporateDeductions.length;

  // Tax policies
  await prisma.taxPolicy.create({
    data: {
      taxSystemId: taxSystem.id,
      policyName: "Small Business Relief Act",
      policyType: "rate_reduction",
      description: "Reduced corporate tax rate for small businesses with revenue under $500K.",
      targetCategory: "corporate",
      impactType: "revenue_decrease",
      rateChange: -6,
      effectiveDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
      isActive: true,
      estimatedRevenue: -2500000000,
      affectedPopulation: 15,
    },
  });
  count++;

  return count;
}

// ─── Cross-Builder Synergies ────────────────────────────────────────

export async function seedCrossBuilderSynergy(prisma: Prisma, countryId: string): Promise<number> {
  const synergies = [
    {
      countryId,
      governmentComponents: JSON.stringify(["DEMOCRATIC_PROCESS", "INDEPENDENT_JUDICIARY"]),
      economicComponents: JSON.stringify(["MIXED_ECONOMY"]),
      taxComponents: JSON.stringify(["PROGRESSIVE_TAX"]),
      synergyType: "governance_economic",
      effectivenessBonus: 8.5,
      description:
        "Balanced Governance — democratic institutions paired with mixed-market economics and progressive taxation create a stable, high-performing economy.",
      isActive: true,
    },
    {
      countryId,
      governmentComponents: JSON.stringify(["REGULATORY_FRAMEWORK"]),
      economicComponents: JSON.stringify(["EXPORT_ORIENTED"]),
      taxComponents: JSON.stringify(["CORPORATE_TAX"]),
      synergyType: "market_reform",
      effectivenessBonus: 6.0,
      description:
        "Market-Oriented Reform — streamlined regulations with export focus and competitive corporate taxation boost trade competitiveness.",
      isActive: true,
    },
  ];

  await prisma.crossBuilderSynergy.createMany({ data: synergies });
  return synergies.length;
}

// ─── Border Security ──────────────────────────────────────────────
