"use client";
import React, { useState, useEffect, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell as ShadcnTableCell, // Renamed to avoid conflict
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell, // Assuming Cell is from recharts, if not, this import might need adjustment
} from "recharts";
import { Slider } from "~/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { toast } from "sonner";
import {
  type Country,
  type EconomicYearData,
  type DMInputs,
  type EconomicModel,
  type SectoralOutput,
  type PolicyEffect,
  } from "~/server/db/schema";  
import { api } from "~/trpc/react";
import { Loader2, Save, PlusCircle, MinusCircle, Info } from "lucide-react";
import {
  Tooltip as ShadcnTooltip, // Renamed to avoid conflict
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  } from "~/components/ui/tooltip";


// Define Cell from recharts if it's not directly exported or used differently
// For example, if it's a prop for Bar component, this direct import might not be needed.
// If `Cell` is a custom component, ensure it's correctly imported from its actual location.
// For now, assuming it's from 'recharts' as it's often used with their charts.

interface EconomicModelingEngineProps {
  country: Country & {
    economicYears: EconomicYearData[];
    dmInputs?: DMInputs | null;
    economicModel?: EconomicModel | null;
  };
  onModelUpdate?: (updatedModel: EconomicModel) => void;
}

const initialSectoralOutput: SectoralOutput = {
  year: new Date().getFullYear(),
  agriculture: 0,
  industry: 0,
  services: 0,
  government: 0,
  totalGDP: 0,
};

const initialPolicyEffect: PolicyEffect = {
  id: "",
  name: "New Policy",
  description: "Details about the policy",
  gdpEffectPercentage: 0,
  inflationEffectPercentage: 0,
  employmentEffectPercentage: 0,
  yearImplemented: new Date().getFullYear(),
  durationYears: 1,
  economicModelId: "",
};

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>((props, ref) => <ShadcnTableCell ref={ref} {...props} />);
TableCell.displayName = "TableCell";


export function EconomicModelingEngine({
  country,
  onModelUpdate,
}: EconomicModelingEngineProps) {
  const [isLoading, setIsLoading] = useState(false);
  const utils = api.useUtils();

  const [baseYear, setBaseYear] = useState<number>(
    country.economicModel?.baseYear ?? new Date().getFullYear(),
  );
  const [projectionYears, setProjectionYears] = useState<number>(
    country.economicModel?.projectionYears ?? 5,
  );
  const [gdpGrowthRate, setGdpGrowthRate] = useState<number>(
    country.economicModel?.gdpGrowthRate ?? 0,
  );
  const [inflationRate, setInflationRate] = useState<number>(
    country.economicModel?.inflationRate ?? 0,
  );
  const [unemploymentRate, setUnemploymentRate] = useState<number>(
    country.economicModel?.unemploymentRate ?? 0,
  );
  const [interestRate, setInterestRate] = useState<number>(
    country.economicModel?.interestRate ?? 0,
  );
  const [exchangeRate, setExchangeRate] = useState<number>(
    country.economicModel?.exchangeRate ?? 0,
  );
  const [populationGrowthRate, setPopulationGrowthRate] = useState<number>(
    country.economicModel?.populationGrowthRate ?? 0,
  );
  const [investmentRate, setInvestmentRate] = useState<number>(
    country.economicModel?.investmentRate ?? 0,
  );
  const [fiscalBalance, setFiscalBalance] = useState<number>(
    country.economicModel?.fiscalBalance ?? 0,
  );
  const [tradeBalance, setTradeBalance] = useState<number>(
    country.economicModel?.tradeBalance ?? 0,
  );

  const [sectoralOutputs, setSectoralOutputs] = useState<SectoralOutput[]>(
    (country.economicModel?.sectoralOutputs as SectoralOutput[]) ?? [
      { ...initialSectoralOutput, year: baseYear },
    ],
  );
  const [policyEffects, setPolicyEffects] = useState<PolicyEffect[]>(
    (country.economicModel?.policyEffects as PolicyEffect[]) ?? [],
  );

  const updateEconomicModelMutation =
    api.countries.updateEconomicData.useMutation({
      onSuccess: (data) => {
        toast.success("Economic model updated successfully!");
        if (data.success && onModelUpdate) {
          // Fetch the updated model data
          void utils.countries.getByIdWithEconomicData.invalidate({ id: country.id });
        }
        setIsLoading(false);
      },
      onError: (error) => {
        toast.error(`Error updating model: ${error.message}`);
        setIsLoading(false);
      },
    });

  useEffect(() => {
    if (country.economicModel) {
      setBaseYear(country.economicModel.baseYear ?? new Date().getFullYear());
      setProjectionYears(country.economicModel.projectionYears ?? 5);
      setGdpGrowthRate(country.economicModel.gdpGrowthRate ?? 0);
      setInflationRate(country.economicModel.inflationRate ?? 0);
      setUnemploymentRate(country.economicModel.unemploymentRate ?? 0);
      setInterestRate(country.economicModel.interestRate ?? 0);
      setExchangeRate(country.economicModel.exchangeRate ?? 0);
      setPopulationGrowthRate(
        country.economicModel.populationGrowthRate ?? 0,
      );
      setInvestmentRate(country.economicModel.investmentRate ?? 0);
      setFiscalBalance(country.economicModel.fiscalBalance ?? 0);
      setTradeBalance(country.economicModel.tradeBalance ?? 0);
      setSectoralOutputs(
        (country.economicModel.sectoralOutputs as SectoralOutput[]) ?? [
          { ...initialSectoralOutput, year: baseYear },
        ],
      );
      setPolicyEffects(
        (country.economicModel.policyEffects as PolicyEffect[]) ?? [],
      );
    }
  }, [country.economicModel, baseYear]);

  const handleSaveModel = () => {
    setIsLoading(true);
    const population = country.population ?? 0;
    const totalGDP = sectoralOutputs[0]?.totalGDP ?? 0;
    const modelData = {
      countryId: country.id,
      economicData: {
        nominalGDP: totalGDP,
        realGDPGrowthRate: gdpGrowthRate,
        inflationRate: inflationRate,
        currencyExchangeRate: exchangeRate,
        unemploymentRate: unemploymentRate,
        interestRates: interestRate,
        populationGrowthRate: populationGrowthRate,
        taxRevenueGDPPercent: fiscalBalance,
        tradeBalance: tradeBalance,
        // Add other required fields with default values
        laborForceParticipationRate: 65,
        employmentRate: 95,
        totalWorkforce: Math.round(population * 0.65),
        averageWorkweekHours: 40,
        minimumWage: 12,
        averageAnnualIncome: 35000,
        governmentBudgetGDPPercent: fiscalBalance + 2,
        budgetDeficitSurplus: 0,
        internalDebtGDPPercent: 45,
        externalDebtGDPPercent: 25,
        totalDebtGDPRatio: 70,
        debtPerCapita: (totalGDP * 0.7) / (population || 1),
        debtServiceCosts: totalGDP * 0.7 * 0.035,
        povertyRate: 15,
        incomeInequalityGini: 0.38,
        socialMobilityIndex: 60,
        totalGovernmentSpending: totalGDP * (fiscalBalance + 2) / 100,
        spendingGDPPercent: fiscalBalance + 2,
        spendingPerCapita: (totalGDP * (fiscalBalance + 2) / 100) / (population || 1),
        lifeExpectancy: 75,
        urbanPopulationPercent: 60,
        ruralPopulationPercent: 40,
        literacyRate: 90
      }
    };
    updateEconomicModelMutation.mutate(modelData);
  };

  const handleSectoralOutputChange = (
    index: number,
    field: keyof SectoralOutput,
    value: string | number,
  ) => {
    const updatedOutputs = [...sectoralOutputs];
    const numericValue = typeof value === "string" ? parseFloat(value) : value;
    if (!isNaN(numericValue)) {
      (updatedOutputs[index] as any)[field] = numericValue; // Type assertion
      // Recalculate totalGDP for the changed sector
      updatedOutputs[index]!.totalGDP =
        (updatedOutputs[index]?.agriculture ?? 0) +
        (updatedOutputs[index]?.industry ?? 0) +
        (updatedOutputs[index]?.services ?? 0) +
        (updatedOutputs[index]?.government ?? 0);
      setSectoralOutputs(updatedOutputs);
    }
  };

  const addSectoralOutputYear = () => {
    const lastYearOutput = sectoralOutputs[sectoralOutputs.length - 1];
    const nextYear = (lastYearOutput?.year ?? baseYear) + 1;
    setSectoralOutputs([
      ...sectoralOutputs,
      { ...initialSectoralOutput, year: nextYear },
    ]);
  };

  const removeSectoralOutputYear = (index: number) => {
    if (sectoralOutputs.length > 1) {
      const updatedOutputs = sectoralOutputs.filter((_, i) => i !== index);
      setSectoralOutputs(updatedOutputs);
    } else {
      toast.error("Cannot remove the last sectoral output year.");
    }
  };

  const handlePolicyEffectChange = (
    index: number,
    field: keyof PolicyEffect,
    value: string | number,
  ) => {
    const updatedPolicies = [...policyEffects];
    if (field === "name" || field === "description") {
      (updatedPolicies[index] as any)[field] = value as string;
    } else {
      const numericValue = typeof value === "string" ? parseFloat(value) : value;
      if (!isNaN(numericValue)) {
        (updatedPolicies[index] as any)[field] = numericValue;
      }
    }
    setPolicyEffects(updatedPolicies);
  };

  const addPolicyEffect = () => {
    setPolicyEffects([
      ...policyEffects,
      {
        ...initialPolicyEffect,
        id: `temp-${Date.now()}`, // Temporary ID for new policies
        economicModelId: country.economicModel?.id ?? "", // Associate with current model if exists
      },
    ]);
  };

  const removePolicyEffect = (index: number) => {
    const updatedPolicies = policyEffects.filter((_, i) => i !== index);
    setPolicyEffects(updatedPolicies);
  };

  const projectedData = useMemo(() => {
    const data = [];
    let currentGDP =
      sectoralOutputs.find((s) => s.year === baseYear)?.totalGDP ??
      country.economicData?.gdp ??
      1000; // Default to 1000 if no base GDP
    let currentPopulation = country.population ?? 1000000; // Default population

    for (let i = 0; i < projectionYears; i++) {
      const year = baseYear + i;
      let yearGdpGrowthRate = gdpGrowthRate;
      let yearInflationRate = inflationRate;
      let yearUnemploymentRate = unemploymentRate;

      // Apply policy effects
      policyEffects.forEach((policy) => {
        if (
          year >= policy.yearImplemented &&
          year < policy.yearImplemented + (policy.durationYears ?? 0)
        ) {
          yearGdpGrowthRate += policy.gdpEffectPercentage ?? 0;
          yearInflationRate += policy.inflationEffectPercentage ?? 0;
          yearUnemploymentRate -= policy.employmentEffectPercentage ?? 0; // Assuming positive effect reduces unemployment
        }
      });

      currentGDP *= 1 + yearGdpGrowthRate / 100;
      currentPopulation *= 1 + populationGrowthRate / 100;

      data.push({
        year: year.toString(),
        gdp: parseFloat(currentGDP.toFixed(2)),
        inflation: parseFloat(
          (inflationRate + yearInflationRate).toFixed(2),
        ), // Simplified, could be compounded
        unemployment: parseFloat(
          Math.max(0, yearUnemploymentRate).toFixed(2),
        ), // Ensure unemployment is not negative
        population: Math.round(currentPopulation),
      });
    }
    return data;
  }, [
    baseYear,
    projectionYears,
    gdpGrowthRate,
    inflationRate,
    unemploymentRate,
    populationGrowthRate,
    sectoralOutputs,
    policyEffects,
    country.economicData?.gdp,
    country.population,
  ]);

  const parameterDescriptions: Record<string, string> = {
    baseYear: "The starting year for the economic model and projections.",
    projectionYears: "Number of years into the future to forecast.",
    gdpGrowthRate:
      "Annual percentage change in Gross Domestic Product (GDP).",
    inflationRate: "Annual percentage increase in the general price level.",
    unemploymentRate:
      "Percentage of the labor force that is jobless and looking for jobs.",
    interestRate:
      "The cost of borrowing money, set by the central bank or market forces.",
    exchangeRate: "Value of the national currency against a benchmark (e.g., USD).",
    populationGrowthRate: "Annual percentage change in population size.",
    investmentRate: "Percentage of GDP allocated to investment.",
    fiscalBalance: "Difference between government revenue and expenditure, as % of GDP.",
    tradeBalance: "Difference between exports and imports, as % of GDP.",
  };

  const renderParameterInput = (
    label: string,
    value: number | undefined,
    setter: (value: number) => void,
    paramKey: string,
    isPercentage = true,
    step = 0.1,
    min = -100,
    max = 100,
  ) => (
    <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-3 md:items-center">
      <label className="font-medium text-sm md:col-span-1">
        {label}
        <TooltipProvider>
          <ShadcnTooltip delayDuration={100}>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="ml-1 h-5 w-5">
                <Info className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs bg-background text-foreground border">
              <p>{parameterDescriptions[paramKey]}</p>
            </TooltipContent>
          </ShadcnTooltip>
        </TooltipProvider>
      </label>
      <Input
        type="number"
        value={value ?? 0} // Default to 0 if undefined
        onChange={(e) => setter(parseFloat(e.target.value))}
        className="md:col-span-1"
        step={step}
      />
      <div className="md:col-span-1 flex items-center space-x-2">
        <Slider
          value={[value ?? 0]} // Default to 0 if undefined
          onValueChange={(val) => setter(val[0] ?? 0)} // Ensure value[0] is not undefined
          max={max}
          min={min}
          step={step}
          className="w-full"
        />
        <span className="text-xs">
          {value ?? 0}
          {isPercentage ? "%" : ""}
        </span>
      </div>
    </div>
  );


  return (
    <Card className="mt-6 shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold">
          Economic Modeling Engine - {country.name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible defaultValue="item-1">
          <AccordionItem value="item-1">
            <AccordionTrigger className="text-lg font-medium">
              Core Parameters
            </AccordionTrigger>
            <AccordionContent className="p-4">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {renderParameterInput(
                  "Base Year",
                  baseYear,
                  setBaseYear,
                  "baseYear",
                  false,
                  1,
                  1900,
                  2100,
                )}
                {renderParameterInput(
                  "Projection Years",
                  projectionYears,
                  setProjectionYears,
                  "projectionYears",
                  false,
                  1,
                  1,
                  50,
                )}
                {renderParameterInput(
                  "GDP Growth Rate (%)",
                  gdpGrowthRate,
                  setGdpGrowthRate,
                  "gdpGrowthRate",
                  true,
                  0.1,
                  -20,
                  20,
                )}
                {renderParameterInput(
                  "Inflation Rate (%)",
                  inflationRate,
                  setInflationRate,
                  "inflationRate",
                  true,
                  0.1,
                  -10,
                  50,
                )}
                {renderParameterInput(
                  "Unemployment Rate (%)",
                  unemploymentRate,
                  setUnemploymentRate,
                  "unemploymentRate",
                  true,
                  0.1,
                  0,
                  50,
                )}
                {renderParameterInput(
                  "Interest Rate (%)",
                  interestRate,
                  setInterestRate,
                  "interestRate",
                  true,
                  0.05,
                  -5,
                  30,
                )}
                {renderParameterInput(
                  "Exchange Rate (to USD)",
                  exchangeRate,
                  setExchangeRate,
                  "exchangeRate",
                  false,
                  0.01,
                  0,
                  1000,
                )}
                {renderParameterInput(
                  "Population Growth Rate (%)",
                  populationGrowthRate,
                  setPopulationGrowthRate,
                  "populationGrowthRate",
                  true,
                  0.01,
                  -5,
                  10,
                )}
                {renderParameterInput(
                  "Investment Rate (% of GDP)",
                  investmentRate,
                  setInvestmentRate,
                  "investmentRate",
                  true,
                  0.5,
                  0,
                  50,
                )}
                {renderParameterInput(
                  "Fiscal Balance (% of GDP)",
                  fiscalBalance,
                  setFiscalBalance,
                  "fiscalBalance",
                  true,
                  0.1,
                  -20,
                  20,
                )}
                {renderParameterInput(
                  "Trade Balance (% of GDP)",
                  tradeBalance,
                  setTradeBalance,
                  "tradeBalance",
                  true,
                  0.1,
                  -20,
                  20,
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-2">
            <AccordionTrigger className="text-lg font-medium">
              Sectoral Outputs (GDP Components)
            </AccordionTrigger>
            <AccordionContent className="p-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Year</TableHead>
                      <TableHead>Agriculture</TableHead>
                      <TableHead>Industry</TableHead>
                      <TableHead>Services</TableHead>
                      <TableHead>Government</TableHead>
                      <TableHead>Total GDP</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sectoralOutputs.map((output, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Input
                            type="number"
                            value={output.year}
                            onChange={(e) =>
                              handleSectoralOutputChange(
                                index,
                                "year",
                                e.target.value,
                              )
                            }
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={output.agriculture}
                            onChange={(e) =>
                              handleSectoralOutputChange(
                                index,
                                "agriculture",
                                e.target.value,
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={output.industry}
                            onChange={(e) =>
                              handleSectoralOutputChange(
                                index,
                                "industry",
                                e.target.value,
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={output.services}
                            onChange={(e) =>
                              handleSectoralOutputChange(
                                index,
                                "services",
                                e.target.value,
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={output.government}
                            onChange={(e) =>
                              handleSectoralOutputChange(
                                index,
                                "government",
                                e.target.value,
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>{output.totalGDP?.toFixed(2) ?? 'N/A'}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeSectoralOutputYear(index)}
                            disabled={sectoralOutputs.length <= 1}
                          >
                            <MinusCircle className="h-5 w-5 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button
                onClick={addSectoralOutputYear}
                variant="outline"
                className="mt-4"
              >
                <PlusCircle className="mr-2 h-4 w-4" /> Add Year
              </Button>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-3">
            <AccordionTrigger className="text-lg font-medium">
              Policy Effects Simulation
            </AccordionTrigger>
            <AccordionContent className="p-4">
              {policyEffects.map((policy, index) => (
                <Card key={policy.id || index} className="mb-4">
                  <CardHeader className="flex flex-row items-center justify-between py-3">
                    <Input
                      value={policy.name}
                      onChange={(e) =>
                        handlePolicyEffectChange(index, "name", e.target.value)
                      }
                      className="text-md font-semibold w-1/2"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removePolicyEffect(index)}
                    >
                      <MinusCircle className="h-5 w-5 text-red-500" />
                    </Button>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium">Description</label>
                      <Input
                        value={policy.description}
                        onChange={(e) =>
                          handlePolicyEffectChange(
                            index,
                            "description",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">
                        Year Implemented
                      </label>
                      <Input
                        type="number"
                        value={policy.yearImplemented}
                        onChange={(e) =>
                          handlePolicyEffectChange(
                            index,
                            "yearImplemented",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">
                        Duration (Years)
                      </label>
                      <Input
                        type="number"
                        value={policy.durationYears ?? 0} // Default to 0
                        onChange={(e) =>
                          handlePolicyEffectChange(
                            index,
                            "durationYears",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">
                        GDP Effect (%)
                      </label>
                      <Input
                        type="number"
                        value={policy.gdpEffectPercentage ?? 0} // Default to 0
                        onChange={(e) =>
                          handlePolicyEffectChange(
                            index,
                            "gdpEffectPercentage",
                            e.target.value,
                          )
                        }
                        step="0.1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">
                        Inflation Effect (%)
                      </label>
                      <Input
                        type="number"
                        value={policy.inflationEffectPercentage ?? 0} // Default to 0
                        onChange={(e) =>
                          handlePolicyEffectChange(
                            index,
                            "inflationEffectPercentage",
                            e.target.value,
                          )
                        }
                        step="0.1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">
                        Employment Effect (%)
                      </label>
                      <Input
                        type="number"
                        value={policy.employmentEffectPercentage ?? 0} // Default to 0
                        onChange={(e) =>
                          handlePolicyEffectChange(
                            index,
                            "employmentEffectPercentage",
                            e.target.value,
                          )
                        }
                        step="0.1"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button onClick={addPolicyEffect} variant="outline">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Policy Scenario
              </Button>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-4">
            <AccordionTrigger className="text-lg font-medium">
              Projections & Visualizations
            </AccordionTrigger>
            <AccordionContent className="p-4">
              <h4 className="mb-4 text-lg font-semibold">
                Economic Projections
              </h4>
              <div className="h-[400px] w-full">
                <ResponsiveContainer>
                  <BarChart data={projectedData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="#82ca9d"
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        name === "gdp"
                          ? `$${value}B`
                          : name === "population"
                            ? `${(value / 1000000).toFixed(2)}M`
                            : `${value}%`,
                        name.charAt(0).toUpperCase() + name.slice(1),
                      ]}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="gdp" fill="#8884d8" name="GDP (Billions)" />
                    <Bar
                      yAxisId="right"
                      dataKey="inflation"
                      fill="#82ca9d"
                      name="Inflation (%)"
                    />
                    <Bar
                      yAxisId="right"
                      dataKey="unemployment"
                      fill="#ffc658"
                      name="Unemployment (%)"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-6 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Year</TableHead>
                      <TableHead>Projected GDP (Billions)</TableHead>
                      <TableHead>Projected Inflation (%)</TableHead>
                      <TableHead>Projected Unemployment (%)</TableHead>
                      <TableHead>Projected Population</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projectedData.map((data) => (
                      <TableRow key={data.year}>
                        <TableCell>{data.year}</TableCell>
                        <TableCell>${data.gdp?.toFixed(2) ?? 'N/A'}</TableCell>
                        <TableCell>{data.inflation?.toFixed(2) ?? 'N/A'}%</TableCell>
                        <TableCell>{data.unemployment?.toFixed(2) ?? 'N/A'}%</TableCell>
                        <TableCell>{data.population?.toLocaleString() ?? 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="mt-8 flex justify-end">
          <Button
            onClick={handleSaveModel}
            disabled={isLoading || updateEconomicModelMutation.isPending}
            size="lg"
          >
            {isLoading || updateEconomicModelMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Economic Model
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default EconomicModelingEngine;

