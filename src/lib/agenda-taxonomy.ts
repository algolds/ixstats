// src/lib/agenda-taxonomy-expanded.ts
/**
 * EXPANDED Hierarchical Agenda Item Taxonomy
 *
 * Comprehensive library of meeting agenda items mapping to game systems
 */

export interface AgendaItemTemplate {
  id: string;
  label: string;
  description: string;
  category: string;
  keywords: string[];
  tags: string[];
  relatedMetrics?: string[];
  decisionType?: string;
  dataMapping?: {
    model: string;
    field?: string;
    filter?: Record<string, any>;
  };
  children?: AgendaItemTemplate[];
}

// Helper function to generate deep taxation items
const generateTaxationItems = (): AgendaItemTemplate => ({
  id: "policy-economic-taxation",
  label: "Taxation Policy",
  description: "Comprehensive tax policy covering all revenue sources",
  category: "economic",
  keywords: ["tax", "taxation", "revenue", "fiscal"],
  tags: ["policy", "economic", "taxation"],
  relatedMetrics: ["taxRevenueGDPPercent", "taxRevenuePerCapita"],
  decisionType: "policy_approval",
  dataMapping: {
    model: "RevenueSource",
  },
  children: [
    {
      id: "policy-economic-taxation-income",
      label: "Income Tax",
      description: "Personal and household income taxation",
      category: "economic",
      keywords: ["income tax", "personal tax", "PAYE"],
      tags: ["policy", "taxation", "income"],
      relatedMetrics: ["taxRevenueGDPPercent", "averageAnnualIncome"],
      decisionType: "policy_approval",
      dataMapping: {
        model: "RevenueSource",
        filter: { name: "Income Tax" },
      },
      children: [
        {
          id: "policy-economic-taxation-income-brackets",
          label: "Tax Brackets & Rates",
          description: "Progressive tax brackets and marginal rates",
          category: "economic",
          keywords: ["tax brackets", "progressive tax", "marginal rates"],
          tags: ["taxation", "income", "rates"],
          decisionType: "policy_approval",
        },
        {
          id: "policy-economic-taxation-income-deductions",
          label: "Tax Deductions & Credits",
          description: "Allowable deductions, tax credits, exemptions",
          category: "economic",
          keywords: ["deductions", "credits", "exemptions"],
          tags: ["taxation", "income", "deductions"],
          decisionType: "policy_approval",
        },
        {
          id: "policy-economic-taxation-income-withholding",
          label: "Withholding & Collection",
          description: "PAYE systems, quarterly payments, enforcement",
          category: "economic",
          keywords: ["withholding", "PAYE", "collection"],
          tags: ["taxation", "income", "enforcement"],
          decisionType: "policy_approval",
        },
      ],
    },
    {
      id: "policy-economic-taxation-corporate",
      label: "Corporate Taxation",
      description: "Business and corporate tax policy",
      category: "economic",
      keywords: ["corporate tax", "business tax", "profits"],
      tags: ["policy", "taxation", "corporate"],
      relatedMetrics: ["taxRevenueGDPPercent", "currentTotalGdp"],
      decisionType: "policy_approval",
      children: [
        {
          id: "policy-economic-taxation-corporate-rates",
          label: "Corporate Tax Rates",
          description: "Standard rates, small business rates, flat vs progressive",
          category: "economic",
          keywords: ["corporate rate", "business rate", "profits tax"],
          tags: ["taxation", "corporate", "rates"],
          decisionType: "policy_approval",
        },
        {
          id: "policy-economic-taxation-corporate-incentives",
          label: "Business Tax Incentives",
          description: "R&D credits, investment incentives, special economic zones",
          category: "economic",
          keywords: ["incentives", "credits", "R&D", "SEZ"],
          tags: ["taxation", "corporate", "incentives"],
          decisionType: "policy_approval",
        },
        {
          id: "policy-economic-taxation-corporate-international",
          label: "International Corporate Tax",
          description: "Transfer pricing, tax treaties, profit shifting prevention",
          category: "economic",
          keywords: ["transfer pricing", "tax treaties", "BEPS"],
          tags: ["taxation", "corporate", "international"],
          decisionType: "policy_approval",
        },
      ],
    },
    {
      id: "policy-economic-taxation-vat",
      label: "Value Added Tax (VAT/GST/Sales Tax)",
      description: "Consumption taxes and indirect taxation",
      category: "economic",
      keywords: ["vat", "gst", "sales tax", "consumption"],
      tags: ["policy", "taxation", "vat"],
      relatedMetrics: ["taxRevenueGDPPercent"],
      decisionType: "policy_approval",
      children: [
        {
          id: "policy-economic-taxation-vat-rates",
          label: "VAT Rates & Structure",
          description: "Standard rate, reduced rates, zero-rated goods",
          category: "economic",
          keywords: ["vat rate", "reduced rate", "zero-rated"],
          tags: ["taxation", "vat", "rates"],
          decisionType: "policy_approval",
        },
        {
          id: "policy-economic-taxation-vat-exemptions",
          label: "VAT Exemptions",
          description: "Essential goods exemptions, services exemptions",
          category: "economic",
          keywords: ["exemptions", "essential goods", "zero-rated"],
          tags: ["taxation", "vat", "exemptions"],
          decisionType: "policy_approval",
        },
      ],
    },
    {
      id: "policy-economic-taxation-property",
      label: "Property & Wealth Taxes",
      description: "Real estate taxes, wealth taxes, inheritance",
      category: "economic",
      keywords: ["property tax", "wealth tax", "estate tax"],
      tags: ["policy", "taxation", "property"],
      decisionType: "policy_approval",
      children: [
        {
          id: "policy-economic-taxation-property-real-estate",
          label: "Real Estate & Land Tax",
          description: "Property taxes, land value tax, vacant property taxes",
          category: "economic",
          keywords: ["property tax", "land tax", "real estate"],
          tags: ["taxation", "property"],
          decisionType: "policy_approval",
        },
        {
          id: "policy-economic-taxation-property-wealth",
          label: "Wealth & Net Worth Tax",
          description: "Annual wealth taxes on high net worth individuals",
          category: "economic",
          keywords: ["wealth tax", "net worth", "assets"],
          tags: ["taxation", "wealth"],
          relatedMetrics: ["incomeInequalityGini"],
          decisionType: "policy_approval",
        },
        {
          id: "policy-economic-taxation-property-inheritance",
          label: "Inheritance & Estate Tax",
          description: "Death duties, estate taxes, generational wealth transfer",
          category: "economic",
          keywords: ["inheritance", "estate tax", "death duty"],
          tags: ["taxation", "inheritance"],
          decisionType: "policy_approval",
        },
      ],
    },
    {
      id: "policy-economic-taxation-excise",
      label: "Excise & Sin Taxes",
      description: "Alcohol, tobacco, fuel, and other excise duties",
      category: "economic",
      keywords: ["excise", "sin tax", "alcohol", "tobacco", "fuel"],
      tags: ["policy", "taxation", "excise"],
      decisionType: "policy_approval",
      children: [
        {
          id: "policy-economic-taxation-excise-alcohol",
          label: "Alcohol Excise Duty",
          description: "Beer, wine, spirits taxation and regulation",
          category: "economic",
          keywords: ["alcohol tax", "beer", "wine", "spirits"],
          tags: ["taxation", "excise", "alcohol"],
          decisionType: "policy_approval",
        },
        {
          id: "policy-economic-taxation-excise-tobacco",
          label: "Tobacco & Smoking Products",
          description: "Cigarette, vaping, and tobacco product taxes",
          category: "economic",
          keywords: ["tobacco tax", "cigarette", "smoking"],
          tags: ["taxation", "excise", "tobacco"],
          decisionType: "policy_approval",
        },
        {
          id: "policy-economic-taxation-excise-fuel",
          label: "Fuel & Energy Excise",
          description: "Gasoline, diesel, and energy taxation",
          category: "economic",
          keywords: ["fuel tax", "gas tax", "energy"],
          tags: ["taxation", "excise", "fuel"],
          decisionType: "policy_approval",
        },
        {
          id: "policy-economic-taxation-excise-carbon",
          label: "Carbon & Environmental Taxes",
          description: "Carbon pricing, emissions trading, pollution taxes",
          category: "economic",
          keywords: ["carbon tax", "emissions", "pollution"],
          tags: ["taxation", "excise", "environmental"],
          decisionType: "policy_approval",
        },
        {
          id: "policy-economic-taxation-excise-sugar",
          label: "Sugar & Health Levies",
          description: "Sugary drinks, junk food, health-related consumption taxes",
          category: "economic",
          keywords: ["sugar tax", "health levy", "soft drinks"],
          tags: ["taxation", "excise", "health"],
          decisionType: "policy_approval",
        },
      ],
    },
    {
      id: "policy-economic-taxation-customs",
      label: "Customs & Import Duties",
      description: "Tariffs, import duties, border taxation",
      category: "economic",
      keywords: ["customs", "tariffs", "import duties"],
      tags: ["policy", "taxation", "customs"],
      relatedMetrics: ["importsGDPPercent"],
      decisionType: "policy_approval",
    },
  ],
});

export const agendaTaxonomy: AgendaItemTemplate[] = [
  // ============================================================
  // POLICY & GOVERNANCE
  // ============================================================
  {
    id: "policy",
    label: "Policy & Governance",
    description: "Government policies, regulations, and governance matters",
    category: "governance",
    keywords: ["policy", "governance", "regulation", "law"],
    tags: ["policy", "governance"],
    children: [
      {
        id: "policy-economic",
        label: "Economic Policy",
        description: "Fiscal, monetary, trade, and economic regulation",
        category: "economic",
        keywords: ["economic", "fiscal", "monetary", "trade"],
        tags: ["policy", "economic"],
        relatedMetrics: ["currentTotalGdp", "adjustedGdpGrowth"],
        decisionType: "policy_approval",
        children: [
          generateTaxationItems(),
          {
            id: "policy-economic-trade",
            label: "Trade & Commerce Policy",
            description: "International trade, tariffs, and commercial regulation",
            category: "economic",
            keywords: ["trade", "commerce", "tariffs", "exports", "imports"],
            tags: ["policy", "economic", "trade"],
            relatedMetrics: ["exportsGDPPercent", "importsGDPPercent"],
            decisionType: "policy_approval",
            children: [
              {
                id: "policy-economic-trade-agreements",
                label: "Trade Agreements",
                description: "Bilateral and multilateral trade deals",
                category: "economic",
                keywords: ["trade agreement", "FTA", "bilateral"],
                tags: ["trade", "agreements"],
                decisionType: "resolution",
              },
              {
                id: "policy-economic-trade-tariffs",
                label: "Tariff Policy",
                description: "Import/export tariffs, trade barriers",
                category: "economic",
                keywords: ["tariffs", "duties", "trade barriers"],
                tags: ["trade", "tariffs"],
                decisionType: "policy_approval",
              },
              {
                id: "policy-economic-trade-export",
                label: "Export Promotion",
                description: "Export incentives, trade missions, market access",
                category: "economic",
                keywords: ["exports", "promotion", "incentives"],
                tags: ["trade", "exports"],
                relatedMetrics: ["exportsGDPPercent"],
                decisionType: "policy_approval",
              },
            ],
          },
          {
            id: "policy-economic-labor",
            label: "Labor & Employment Policy",
            description: "Workforce regulation, labor rights, employment programs",
            category: "economic",
            keywords: ["labor", "employment", "workers", "unions"],
            tags: ["policy", "economic", "labor"],
            relatedMetrics: ["unemploymentRate", "laborForceParticipationRate"],
            decisionType: "policy_approval",
            children: [
              {
                id: "policy-economic-labor-minimum-wage",
                label: "Minimum Wage",
                description: "Wage floors, living wage, regional variations",
                category: "economic",
                keywords: ["minimum wage", "living wage", "wage floor"],
                tags: ["labor", "wages"],
                relatedMetrics: ["minimumWage", "povertyRate"],
                decisionType: "policy_approval",
              },
              {
                id: "policy-economic-labor-unions",
                label: "Labor Union Rights",
                description: "Collective bargaining, union organization, strikes",
                category: "economic",
                keywords: ["unions", "collective bargaining", "strikes"],
                tags: ["labor", "unions"],
                decisionType: "policy_approval",
              },
              {
                id: "policy-economic-labor-hours",
                label: "Working Hours & Conditions",
                description: "Maximum hours, overtime, breaks, workplace safety",
                category: "economic",
                keywords: ["working hours", "overtime", "workplace safety"],
                tags: ["labor", "workplace"],
                relatedMetrics: ["averageWorkweekHours"],
                decisionType: "policy_approval",
              },
              {
                id: "policy-economic-labor-unemployment",
                label: "Unemployment Support",
                description: "Unemployment insurance, job training, placement services",
                category: "economic",
                keywords: ["unemployment", "benefits", "job training"],
                tags: ["labor", "unemployment"],
                relatedMetrics: ["unemploymentRate"],
                decisionType: "policy_approval",
              },
              {
                id: "policy-economic-labor-discrimination",
                label: "Anti-Discrimination Laws",
                description: "Equal opportunity, harassment prevention, diversity",
                category: "economic",
                keywords: ["discrimination", "equal opportunity", "diversity"],
                tags: ["labor", "rights"],
                decisionType: "policy_approval",
              },
              {
                id: "policy-economic-labor-maternity",
                label: "Parental Leave & Family Policy",
                description: "Maternity/paternity leave, childcare support",
                category: "economic",
                keywords: ["maternity", "parental leave", "childcare"],
                tags: ["labor", "family"],
                decisionType: "policy_approval",
              },
            ],
          },
          {
            id: "policy-economic-monetary",
            label: "Monetary Policy Coordination",
            description: "Interest rates, inflation targeting, currency management",
            category: "economic",
            keywords: ["monetary", "interest rates", "inflation", "central bank"],
            tags: ["policy", "economic", "monetary"],
            relatedMetrics: ["inflationRate", "interestRates"],
            decisionType: "policy_approval",
            children: [
              {
                id: "policy-economic-monetary-inflation",
                label: "Inflation Targeting",
                description: "Inflation targets, price stability measures",
                category: "economic",
                keywords: ["inflation", "price stability", "targeting"],
                tags: ["monetary", "inflation"],
                relatedMetrics: ["inflationRate"],
                decisionType: "policy_approval",
              },
              {
                id: "policy-economic-monetary-currency",
                label: "Exchange Rate Policy",
                description: "Currency valuation, forex intervention, peg policy",
                category: "economic",
                keywords: ["exchange rate", "currency", "forex"],
                tags: ["monetary", "currency"],
                relatedMetrics: ["currencyExchangeRate"],
                decisionType: "policy_approval",
              },
            ],
          },
          {
            id: "policy-economic-debt",
            label: "National Debt Management",
            description: "Debt issuance, refinancing, fiscal sustainability",
            category: "economic",
            keywords: ["debt", "bonds", "fiscal", "borrowing"],
            tags: ["policy", "economic", "debt"],
            relatedMetrics: ["totalDebtGDPRatio", "debtServiceCosts"],
            decisionType: "policy_approval",
          },
          {
            id: "policy-economic-competition",
            label: "Competition & Antitrust",
            description: "Monopoly regulation, merger control, market competition",
            category: "economic",
            keywords: ["competition", "antitrust", "monopoly", "mergers"],
            tags: ["policy", "economic", "competition"],
            decisionType: "policy_approval",
          },
          {
            id: "policy-economic-investment",
            label: "Investment Policy",
            description: "FDI rules, capital markets, securities regulation",
            category: "economic",
            keywords: ["investment", "FDI", "capital", "securities"],
            tags: ["policy", "economic", "investment"],
            decisionType: "policy_approval",
          },
        ],
      },
      {
        id: "policy-social",
        label: "Social Policy",
        description: "Healthcare, education, welfare, and social programs",
        category: "social",
        keywords: ["social", "healthcare", "education", "welfare"],
        tags: ["policy", "social"],
        relatedMetrics: ["lifeExpectancy", "literacyRate", "povertyRate"],
        decisionType: "policy_approval",
        children: [
          {
            id: "policy-social-healthcare",
            label: "Healthcare Policy",
            description: "Public health systems, insurance, medical services",
            category: "social",
            keywords: ["healthcare", "health", "medical", "hospitals"],
            tags: ["policy", "social", "healthcare"],
            relatedMetrics: ["lifeExpectancy"],
            decisionType: "policy_approval",
            children: [
              {
                id: "policy-social-healthcare-universal",
                label: "Universal Healthcare Coverage",
                description: "Public health insurance, single-payer systems",
                category: "social",
                keywords: ["universal healthcare", "public health", "insurance"],
                tags: ["healthcare", "coverage"],
                decisionType: "policy_approval",
              },
              {
                id: "policy-social-healthcare-primary",
                label: "Primary Care Services",
                description: "GP services, clinics, preventive care",
                category: "social",
                keywords: ["primary care", "GP", "clinics"],
                tags: ["healthcare", "primary"],
                decisionType: "policy_approval",
              },
              {
                id: "policy-social-healthcare-hospitals",
                label: "Hospital & Emergency Services",
                description: "Hospital capacity, emergency care, specialist services",
                category: "social",
                keywords: ["hospitals", "emergency", "specialist"],
                tags: ["healthcare", "hospitals"],
                decisionType: "policy_approval",
              },
              {
                id: "policy-social-healthcare-mental",
                label: "Mental Health Services",
                description: "Psychiatric care, counseling, mental health support",
                category: "social",
                keywords: ["mental health", "psychiatric", "counseling"],
                tags: ["healthcare", "mental"],
                decisionType: "policy_approval",
              },
              {
                id: "policy-social-healthcare-pharmaceutical",
                label: "Pharmaceutical Policy",
                description: "Drug pricing, generic medications, prescription subsidies",
                category: "social",
                keywords: ["pharmaceutical", "drugs", "medications"],
                tags: ["healthcare", "pharmaceutical"],
                decisionType: "policy_approval",
              },
            ],
          },
          {
            id: "policy-social-education",
            label: "Education Policy",
            description: "Schools, universities, vocational training, literacy",
            category: "social",
            keywords: ["education", "schools", "universities", "training"],
            tags: ["policy", "social", "education"],
            relatedMetrics: ["literacyRate"],
            decisionType: "policy_approval",
            children: [
              {
                id: "policy-social-education-primary",
                label: "Primary Education",
                description: "Elementary schools, basic literacy, compulsory education",
                category: "social",
                keywords: ["primary school", "elementary", "literacy"],
                tags: ["education", "primary"],
                decisionType: "policy_approval",
              },
              {
                id: "policy-social-education-secondary",
                label: "Secondary Education",
                description: "High schools, vocational schools, college prep",
                category: "social",
                keywords: ["secondary", "high school", "vocational"],
                tags: ["education", "secondary"],
                decisionType: "policy_approval",
              },
              {
                id: "policy-social-education-higher",
                label: "Higher Education",
                description: "Universities, colleges, tuition fees, student loans",
                category: "social",
                keywords: ["university", "college", "higher education"],
                tags: ["education", "higher"],
                decisionType: "policy_approval",
              },
              {
                id: "policy-social-education-vocational",
                label: "Vocational & Technical Training",
                description: "Trade schools, apprenticeships, skills training",
                category: "social",
                keywords: ["vocational", "apprenticeship", "trade school"],
                tags: ["education", "vocational"],
                decisionType: "policy_approval",
              },
              {
                id: "policy-social-education-curriculum",
                label: "Curriculum Standards",
                description: "National curriculum, testing, educational standards",
                category: "social",
                keywords: ["curriculum", "standards", "testing"],
                tags: ["education", "curriculum"],
                decisionType: "policy_approval",
              },
            ],
          },
          {
            id: "policy-social-welfare",
            label: "Social Welfare Programs",
            description: "Safety nets, poverty reduction, social assistance",
            category: "social",
            keywords: ["welfare", "benefits", "poverty", "assistance"],
            tags: ["policy", "social", "welfare"],
            relatedMetrics: ["povertyRate", "incomeInequalityGini"],
            decisionType: "policy_approval",
            children: [
              {
                id: "policy-social-welfare-income",
                label: "Income Support Programs",
                description: "Cash transfers, basic income, family allowances",
                category: "social",
                keywords: ["income support", "cash transfer", "allowances"],
                tags: ["welfare", "income"],
                decisionType: "policy_approval",
              },
              {
                id: "policy-social-welfare-housing",
                label: "Housing Assistance",
                description: "Public housing, rental subsidies, homelessness prevention",
                category: "social",
                keywords: ["housing", "subsidies", "homelessness"],
                tags: ["welfare", "housing"],
                decisionType: "policy_approval",
              },
              {
                id: "policy-social-welfare-food",
                label: "Food Security Programs",
                description: "Food stamps, school meals, nutrition assistance",
                category: "social",
                keywords: ["food stamps", "nutrition", "meals"],
                tags: ["welfare", "food"],
                decisionType: "policy_approval",
              },
            ],
          },
          {
            id: "policy-social-pension",
            label: "Pension & Retirement Policy",
            description: "State pensions, retirement age, elderly care",
            category: "social",
            keywords: ["pension", "retirement", "elderly", "social security"],
            tags: ["policy", "social", "pension"],
            decisionType: "policy_approval",
          },
          {
            id: "policy-social-disability",
            label: "Disability & Special Needs",
            description: "Disability benefits, accessibility, support services",
            category: "social",
            keywords: ["disability", "accessibility", "special needs"],
            tags: ["policy", "social", "disability"],
            decisionType: "policy_approval",
          },
        ],
      },
      {
        id: "policy-infrastructure",
        label: "Infrastructure Policy",
        description: "Transportation, utilities, public works, development",
        category: "infrastructure",
        keywords: ["infrastructure", "transportation", "utilities", "development"],
        tags: ["policy", "infrastructure"],
        decisionType: "policy_approval",
        children: [
          {
            id: "policy-infrastructure-transport",
            label: "Transportation Infrastructure",
            description: "Roads, railways, airports, ports, public transit",
            category: "infrastructure",
            keywords: ["transport", "roads", "railways", "airports"],
            tags: ["infrastructure", "transportation"],
            decisionType: "policy_approval",
            children: [
              {
                id: "policy-infrastructure-transport-roads",
                label: "Road Network",
                description: "Highways, motorways, road maintenance, expansion",
                category: "infrastructure",
                keywords: ["roads", "highways", "motorways"],
                tags: ["infrastructure", "roads"],
                decisionType: "policy_approval",
              },
              {
                id: "policy-infrastructure-transport-rail",
                label: "Railway Systems",
                description: "Passenger rail, freight rail, high-speed rail",
                category: "infrastructure",
                keywords: ["railway", "trains", "rail network"],
                tags: ["infrastructure", "rail"],
                decisionType: "policy_approval",
              },
              {
                id: "policy-infrastructure-transport-public",
                label: "Public Transit",
                description: "Buses, metro, trams, urban mobility",
                category: "infrastructure",
                keywords: ["public transit", "buses", "metro", "trams"],
                tags: ["infrastructure", "transit"],
                decisionType: "policy_approval",
              },
              {
                id: "policy-infrastructure-transport-air",
                label: "Aviation Infrastructure",
                description: "Airports, air traffic control, aviation policy",
                category: "infrastructure",
                keywords: ["airports", "aviation", "air travel"],
                tags: ["infrastructure", "aviation"],
                decisionType: "policy_approval",
              },
              {
                id: "policy-infrastructure-transport-ports",
                label: "Maritime & Ports",
                description: "Seaports, harbors, shipping infrastructure",
                category: "infrastructure",
                keywords: ["ports", "harbors", "maritime", "shipping"],
                tags: ["infrastructure", "maritime"],
                decisionType: "policy_approval",
              },
            ],
          },
          {
            id: "policy-infrastructure-utilities",
            label: "Utilities & Services",
            description: "Water, electricity, gas, telecommunications",
            category: "infrastructure",
            keywords: ["utilities", "water", "electricity", "telecoms"],
            tags: ["infrastructure", "utilities"],
            decisionType: "policy_approval",
            children: [
              {
                id: "policy-infrastructure-utilities-water",
                label: "Water & Sanitation",
                description: "Water supply, sewerage, wastewater treatment",
                category: "infrastructure",
                keywords: ["water", "sanitation", "sewerage"],
                tags: ["infrastructure", "water"],
                decisionType: "policy_approval",
              },
              {
                id: "policy-infrastructure-utilities-electricity",
                label: "Electricity Grid",
                description: "Power generation, transmission, distribution",
                category: "infrastructure",
                keywords: ["electricity", "power", "grid", "energy"],
                tags: ["infrastructure", "electricity"],
                decisionType: "policy_approval",
              },
              {
                id: "policy-infrastructure-utilities-telecom",
                label: "Telecommunications",
                description: "Internet, mobile networks, broadband, 5G",
                category: "infrastructure",
                keywords: ["telecommunications", "internet", "broadband", "5G"],
                tags: ["infrastructure", "telecom"],
                decisionType: "policy_approval",
              },
              {
                id: "policy-infrastructure-utilities-waste",
                label: "Waste Management",
                description: "Garbage collection, recycling, landfills",
                category: "infrastructure",
                keywords: ["waste", "garbage", "recycling"],
                tags: ["infrastructure", "waste"],
                decisionType: "policy_approval",
              },
            ],
          },
          {
            id: "policy-infrastructure-housing",
            label: "Housing & Urban Development",
            description: "Public housing, urban planning, zoning",
            category: "infrastructure",
            keywords: ["housing", "urban", "planning", "zoning"],
            tags: ["infrastructure", "housing"],
            relatedMetrics: ["urbanPopulationPercent"],
            decisionType: "policy_approval",
          },
          {
            id: "policy-infrastructure-digital",
            label: "Digital Infrastructure",
            description: "Broadband expansion, digital services, e-government",
            category: "infrastructure",
            keywords: ["digital", "broadband", "e-government", "connectivity"],
            tags: ["infrastructure", "digital"],
            decisionType: "policy_approval",
          },
        ],
      },
      {
        id: "policy-environmental",
        label: "Environmental Policy",
        description: "Climate change, conservation, pollution control",
        category: "infrastructure",
        keywords: ["environment", "climate", "pollution", "conservation"],
        tags: ["policy", "environmental"],
        decisionType: "policy_approval",
        children: [
          {
            id: "policy-environmental-climate",
            label: "Climate Change Mitigation",
            description: "Emissions reduction, renewable energy, carbon neutrality",
            category: "infrastructure",
            keywords: ["climate change", "emissions", "carbon neutral"],
            tags: ["environmental", "climate"],
            decisionType: "policy_approval",
          },
          {
            id: "policy-environmental-conservation",
            label: "Natural Conservation",
            description: "Protected areas, biodiversity, wildlife protection",
            category: "infrastructure",
            keywords: ["conservation", "biodiversity", "wildlife"],
            tags: ["environmental", "conservation"],
            decisionType: "policy_approval",
          },
          {
            id: "policy-environmental-pollution",
            label: "Pollution Control",
            description: "Air quality, water pollution, industrial emissions",
            category: "infrastructure",
            keywords: ["pollution", "air quality", "emissions"],
            tags: ["environmental", "pollution"],
            decisionType: "policy_approval",
          },
          {
            id: "policy-environmental-renewable",
            label: "Renewable Energy",
            description: "Solar, wind, hydro, geothermal energy transition",
            category: "infrastructure",
            keywords: ["renewable", "solar", "wind", "clean energy"],
            tags: ["environmental", "renewable"],
            decisionType: "policy_approval",
          },
        ],
      },
      {
        id: "policy-justice",
        label: "Justice & Legal System",
        description: "Courts, legal reform, criminal justice, civil law",
        category: "governance",
        keywords: ["justice", "legal", "courts", "law"],
        tags: ["policy", "justice"],
        decisionType: "policy_approval",
        children: [
          {
            id: "policy-justice-criminal",
            label: "Criminal Justice Reform",
            description: "Sentencing, prisons, rehabilitation, policing",
            category: "governance",
            keywords: ["criminal justice", "prisons", "sentencing"],
            tags: ["justice", "criminal"],
            decisionType: "policy_approval",
          },
          {
            id: "policy-justice-civil",
            label: "Civil Law & Courts",
            description: "Civil litigation, small claims, legal aid",
            category: "governance",
            keywords: ["civil law", "litigation", "courts"],
            tags: ["justice", "civil"],
            decisionType: "policy_approval",
          },
        ],
      },
    ],
  },

  // ============================================================
  // BUDGET & FINANCE (Continued with more detail...)
  // ============================================================
  {
    id: "budget",
    label: "Budget & Finance",
    description: "Government spending, fiscal planning, financial management",
    category: "economic",
    keywords: ["budget", "finance", "spending", "fiscal"],
    tags: ["budget", "finance"],
    relatedMetrics: ["totalGovernmentSpending", "budgetDeficitSurplus"],
    decisionType: "budget_allocation",
    children: [
      {
        id: "budget-annual",
        label: "Annual Budget Planning",
        description: "Overall fiscal year budget preparation and allocation",
        category: "economic",
        keywords: ["annual budget", "fiscal year", "allocation"],
        tags: ["budget", "annual"],
        relatedMetrics: ["totalGovernmentSpending"],
        decisionType: "budget_allocation",
        dataMapping: {
          model: "GovernmentStructure",
          field: "totalBudget",
        },
      },
      {
        id: "budget-departments",
        label: "Department Budgets",
        description: "Allocating budget across ministries and departments",
        category: "economic",
        keywords: ["departments", "ministries", "allocation"],
        tags: ["budget", "departments"],
        decisionType: "budget_allocation",
        dataMapping: {
          model: "BudgetAllocation",
        },
        children: [
          {
            id: "budget-departments-defense",
            label: "Defense & Military Budget",
            description: "Armed forces, military equipment, national defense spending",
            category: "security",
            keywords: ["defense", "military", "armed forces"],
            tags: ["budget", "defense"],
            decisionType: "budget_allocation",
            dataMapping: {
              model: "GovernmentDepartment",
              filter: { category: "Defense" },
            },
          },
          {
            id: "budget-departments-education",
            label: "Education Budget",
            description: "Schools, universities, educational programs funding",
            category: "social",
            keywords: ["education", "schools", "universities"],
            tags: ["budget", "education"],
            relatedMetrics: ["literacyRate"],
            decisionType: "budget_allocation",
            dataMapping: {
              model: "GovernmentDepartment",
              filter: { category: "Education" },
            },
          },
          {
            id: "budget-departments-health",
            label: "Healthcare Budget",
            description: "Hospitals, public health, medical services funding",
            category: "social",
            keywords: ["healthcare", "hospitals", "medical"],
            tags: ["budget", "healthcare"],
            relatedMetrics: ["lifeExpectancy"],
            decisionType: "budget_allocation",
            dataMapping: {
              model: "GovernmentDepartment",
              filter: { category: "Health" },
            },
          },
          {
            id: "budget-departments-infrastructure",
            label: "Infrastructure Budget",
            description: "Public works, transportation, utilities funding",
            category: "infrastructure",
            keywords: ["infrastructure", "public works", "construction"],
            tags: ["budget", "infrastructure"],
            decisionType: "budget_allocation",
            dataMapping: {
              model: "GovernmentDepartment",
              filter: { category: "Infrastructure" },
            },
          },
          {
            id: "budget-departments-social",
            label: "Social Services Budget",
            description: "Welfare programs, social assistance, poverty reduction",
            category: "social",
            keywords: ["social services", "welfare", "assistance"],
            tags: ["budget", "social"],
            relatedMetrics: ["povertyRate"],
            decisionType: "budget_allocation",
          },
          {
            id: "budget-departments-justice",
            label: "Justice & Law Enforcement Budget",
            description: "Courts, police, prisons, legal system funding",
            category: "governance",
            keywords: ["justice", "police", "courts", "law enforcement"],
            tags: ["budget", "justice"],
            decisionType: "budget_allocation",
          },
          {
            id: "budget-departments-foreign",
            label: "Foreign Affairs Budget",
            description: "Diplomacy, embassies, international relations",
            category: "diplomatic",
            keywords: ["foreign affairs", "diplomacy", "embassies"],
            tags: ["budget", "diplomatic"],
            decisionType: "budget_allocation",
          },
        ],
      },
      {
        id: "budget-revenue",
        label: "Revenue Forecasting",
        description: "Tax revenue projections, economic assumptions",
        category: "economic",
        keywords: ["revenue", "forecasting", "projections"],
        tags: ["budget", "revenue"],
        relatedMetrics: ["taxRevenueGDPPercent", "governmentRevenueTotal"],
        decisionType: "resolution",
        dataMapping: {
          model: "RevenueSource",
        },
      },
      {
        id: "budget-deficit",
        label: "Deficit & Surplus Management",
        description: "Managing budget balance, borrowing needs",
        category: "economic",
        keywords: ["deficit", "surplus", "balance", "borrowing"],
        tags: ["budget", "deficit"],
        relatedMetrics: ["budgetDeficitSurplus"],
        decisionType: "policy_approval",
      },
      {
        id: "budget-capital",
        label: "Capital Expenditure Planning",
        description: "Major projects, infrastructure investments, long-term spending",
        category: "economic",
        keywords: ["capital", "projects", "infrastructure", "investment"],
        tags: ["budget", "capital"],
        decisionType: "budget_allocation",
      },
    ],
  },

  // ============================================================
  // GOVERNMENT OPERATIONS
  // ============================================================
  {
    id: "operations",
    label: "Government Operations",
    description: "Administrative functions, personnel, organizational matters",
    category: "governance",
    keywords: ["operations", "administration", "management"],
    tags: ["operations", "governance"],
    children: [
      {
        id: "operations-appointments",
        label: "Appointments & Personnel",
        description: "Cabinet appointments, officials, staffing decisions",
        category: "governance",
        keywords: ["appointments", "personnel", "cabinet", "officials"],
        tags: ["operations", "appointments"],
        decisionType: "appointment",
        dataMapping: {
          model: "GovernmentOfficial",
        },
        children: [
          {
            id: "operations-appointments-cabinet",
            label: "Cabinet Appointments",
            description: "Ministerial appointments, cabinet reshuffles",
            category: "governance",
            keywords: ["cabinet", "ministers", "appointments"],
            tags: ["appointments", "cabinet"],
            decisionType: "appointment",
          },
          {
            id: "operations-appointments-senior",
            label: "Senior Officials",
            description: "Department heads, permanent secretaries, directors",
            category: "governance",
            keywords: ["senior officials", "directors", "secretaries"],
            tags: ["appointments", "officials"],
            decisionType: "appointment",
          },
          {
            id: "operations-appointments-judiciary",
            label: "Judicial Appointments",
            description: "Judges, magistrates, legal officials",
            category: "governance",
            keywords: ["judges", "judiciary", "magistrates"],
            tags: ["appointments", "judiciary"],
            decisionType: "appointment",
          },
        ],
      },
      {
        id: "operations-restructuring",
        label: "Government Restructuring",
        description: "Organizational changes, department creation/merger",
        category: "governance",
        keywords: ["restructuring", "reorganization", "departments"],
        tags: ["operations", "restructuring"],
        decisionType: "directive",
        dataMapping: {
          model: "GovernmentDepartment",
        },
      },
      {
        id: "operations-performance",
        label: "Performance Management",
        description: "KPIs, efficiency reviews, service quality",
        category: "governance",
        keywords: ["performance", "efficiency", "KPI", "metrics"],
        tags: ["operations", "performance"],
        decisionType: "resolution",
      },
      {
        id: "operations-digitalization",
        label: "Government Digitalization",
        description: "E-government services, digital transformation, IT systems",
        category: "governance",
        keywords: ["digitalization", "e-government", "IT", "digital services"],
        tags: ["operations", "digital"],
        decisionType: "directive",
      },
      {
        id: "operations-procurement",
        label: "Public Procurement",
        description: "Contracting, tenders, supplier management",
        category: "governance",
        keywords: ["procurement", "contracts", "tenders"],
        tags: ["operations", "procurement"],
        decisionType: "resolution",
      },
    ],
  },

  // ============================================================
  // STRATEGIC PLANNING
  // ============================================================
  {
    id: "strategic",
    label: "Strategic Planning",
    description: "Long-term vision, national priorities, development strategy",
    category: "governance",
    keywords: ["strategic", "planning", "vision", "priorities"],
    tags: ["strategic", "planning"],
    children: [
      {
        id: "strategic-economic",
        label: "Economic Development Strategy",
        description: "Long-term growth plans, industrialization, competitiveness",
        category: "economic",
        keywords: ["economic development", "growth", "industrialization"],
        tags: ["strategic", "economic"],
        relatedMetrics: ["adjustedGdpGrowth"],
        decisionType: "directive",
      },
      {
        id: "strategic-demographic",
        label: "Demographic Planning",
        description: "Population policy, urbanization, migration",
        category: "social",
        keywords: ["demographic", "population", "urbanization"],
        tags: ["strategic", "demographic"],
        relatedMetrics: ["populationGrowthRate", "urbanPopulationPercent"],
        decisionType: "directive",
      },
      {
        id: "strategic-innovation",
        label: "Innovation & Technology Strategy",
        description: "R&D policy, tech sector development, innovation hubs",
        category: "economic",
        keywords: ["innovation", "technology", "R&D"],
        tags: ["strategic", "innovation"],
        decisionType: "directive",
      },
      {
        id: "strategic-sustainability",
        label: "Sustainability Goals",
        description: "Environmental targets, sustainable development, green economy",
        category: "infrastructure",
        keywords: ["sustainability", "sustainable development", "green"],
        tags: ["strategic", "sustainability"],
        decisionType: "directive",
      },
    ],
  },

  // ============================================================
  // CRISIS & EMERGENCY
  // ============================================================
  {
    id: "crisis",
    label: "Crisis & Emergency Response",
    description: "Urgent matters requiring immediate government action",
    category: "security",
    keywords: ["crisis", "emergency", "urgent", "disaster"],
    tags: ["crisis", "emergency", "urgent"],
    decisionType: "directive",
    children: [
      {
        id: "crisis-economic",
        label: "Economic Crisis Management",
        description: "Financial emergency, recession response, bailouts",
        category: "economic",
        keywords: ["economic crisis", "recession", "bailout"],
        tags: ["crisis", "economic", "urgent"],
        decisionType: "directive",
      },
      {
        id: "crisis-security",
        label: "Security Emergency",
        description: "National security threats, defense readiness",
        category: "security",
        keywords: ["security", "defense", "threat", "emergency"],
        tags: ["crisis", "security", "urgent"],
        decisionType: "directive",
      },
      {
        id: "crisis-natural",
        label: "Natural Disaster Response",
        description: "Earthquakes, floods, storms, emergency relief",
        category: "social",
        keywords: ["disaster", "earthquake", "flood", "relief"],
        tags: ["crisis", "disaster", "urgent"],
        decisionType: "directive",
      },
      {
        id: "crisis-pandemic",
        label: "Public Health Emergency",
        description: "Disease outbreaks, pandemic response, health crisis",
        category: "social",
        keywords: ["pandemic", "outbreak", "health crisis"],
        tags: ["crisis", "health", "urgent"],
        decisionType: "directive",
      },
    ],
  },

  // ============================================================
  // DIPLOMATIC & INTERNATIONAL
  // ============================================================
  {
    id: "diplomatic",
    label: "Diplomatic & International Affairs",
    description: "Foreign relations, treaties, international cooperation",
    category: "diplomatic",
    keywords: ["diplomatic", "international", "foreign"],
    tags: ["diplomatic", "international"],
    children: [
      {
        id: "diplomatic-treaties",
        label: "International Treaties",
        description: "Trade agreements, defense pacts, cooperation treaties",
        category: "diplomatic",
        keywords: ["treaties", "agreements", "pacts"],
        tags: ["diplomatic", "treaties"],
        decisionType: "resolution",
      },
      {
        id: "diplomatic-relations",
        label: "Bilateral Relations",
        description: "Country-to-country diplomacy, embassy operations",
        category: "diplomatic",
        keywords: ["bilateral", "relations", "embassy"],
        tags: ["diplomatic", "bilateral"],
        decisionType: "resolution",
      },
      {
        id: "diplomatic-multilateral",
        label: "Multilateral Organizations",
        description: "UN, regional bodies, international organizations",
        category: "diplomatic",
        keywords: ["multilateral", "UN", "international organizations"],
        tags: ["diplomatic", "multilateral"],
        decisionType: "resolution",
      },
      {
        id: "diplomatic-aid",
        label: "Foreign Aid & Development",
        description: "International development assistance, humanitarian aid",
        category: "diplomatic",
        keywords: ["foreign aid", "development", "humanitarian"],
        tags: ["diplomatic", "aid"],
        decisionType: "budget_allocation",
      },
    ],
  },
];

// Utility functions
export function flattenTaxonomy(
  items: AgendaItemTemplate[] = agendaTaxonomy,
  depth = 0
): AgendaItemTemplate[] {
  const result: AgendaItemTemplate[] = [];
  for (const item of items) {
    result.push({ ...item, children: undefined });
    if (item.children) {
      result.push(...flattenTaxonomy(item.children, depth + 1));
    }
  }
  return result;
}

export function searchAgendaItems(
  query: string,
  items: AgendaItemTemplate[] = agendaTaxonomy
): AgendaItemTemplate[] {
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return [];
  const flatItems = flattenTaxonomy(items);
  return flatItems.filter(
    (item) =>
      item.label.toLowerCase().includes(lowerQuery) ||
      item.description.toLowerCase().includes(lowerQuery) ||
      item.keywords.some((kw) => kw.toLowerCase().includes(lowerQuery)) ||
      item.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
  );
}

export function getAgendaItemById(
  id: string,
  items: AgendaItemTemplate[] = agendaTaxonomy
): AgendaItemTemplate | null {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.children) {
      const found = getAgendaItemById(id, item.children);
      if (found) return found;
    }
  }
  return null;
}

export function getAgendaItemPath(
  id: string,
  items: AgendaItemTemplate[] = agendaTaxonomy,
  path: AgendaItemTemplate[] = []
): AgendaItemTemplate[] | null {
  for (const item of items) {
    const currentPath = [...path, item];
    if (item.id === id) return currentPath;
    if (item.children) {
      const found = getAgendaItemPath(id, item.children, currentPath);
      if (found) return found;
    }
  }
  return null;
}
