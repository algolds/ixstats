// src/app/dm-dashboard/page.tsx
// src/app/dm-dashboard/page.tsx
"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";
import {
  Database,
  Plus,
  Trash2,
  Edit3,
  Globe,
  Zap,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Clock,
  Target,
  Activity,
  Save,
  XCircle,
  Users,
} from "lucide-react";

const DM_INPUT_TYPES = [
  { value: "population_adjustment", label: "Population Adjustment", icon: Users, color: "blue" }, // Changed Icon
  { value: "gdp_adjustment", label: "GDP Adjustment", icon: TrendingUp, color: "green" },
  { value: "growth_rate_modifier", label: "Growth Rate Modifier", icon: Activity, color: "purple" },
  { value: "special_event", label: "Special Event", icon: Zap, color: "yellow" },
  { value: "trade_agreement", label: "Trade Agreement", icon: Target, color: "indigo" },
  { value: "natural_disaster", label: "Natural Disaster", icon: AlertTriangle, color: "red" },
  { value: "economic_policy", label: "Economic Policy", icon: TrendingDown, color: "orange" }, // Changed Icon
] as const;

type DmInputType = typeof DM_INPUT_TYPES[number]["value"];

interface DmInputFormData {
  countryId?: string;
  inputType: DmInputType;
  value: number;
  description: string;
  duration?: number;
}

interface DmInput {
  id: string;
  countryId?: string;
  ixTimeTimestamp: Date;
  inputType: string;
  value: number;
  description?: string;
  duration?: number;
  isActive: boolean;
  createdBy?: string;
}

export default function DmDashboard() {
  const [showForm, setShowForm] = useState(false);
  const [editingInput, setEditingInput] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string>("global");
  const [formData, setFormData] = useState<DmInputFormData>({
    inputType: "population_adjustment",
    value: 0,
    description: "",
  });

  // Queries
  const { data: countries, isLoading: countriesLoading } = api.countries.getAll.useQuery();
  const { data: dmInputs, refetch: refetchDmInputs, isLoading: inputsLoading } = api.countries.getDmInputs.useQuery({
    countryId: selectedCountry === "global" ? undefined : selectedCountry,
  });

  // Mutations
  const addDmInputMutation = api.countries.addDmInput.useMutation({
    onSuccess: () => {
      refetchDmInputs();
      setShowForm(false);
      setFormData({
        inputType: "population_adjustment",
        value: 0,
        description: "",
      });
    },
    onError: (error) => alert(`Error adding input: ${error.message}`),
  });

  const updateDmInputMutation = api.countries.updateDmInput.useMutation({
    onSuccess: () => {
      refetchDmInputs();
      setEditingInput(null);
      setShowForm(false);
    },
    onError: (error) => alert(`Error updating input: ${error.message}`),
  });

  const deleteDmInputMutation = api.countries.deleteDmInput.useMutation({
    onSuccess: () => {
      refetchDmInputs();
    },
    onError: (error) => alert(`Error deleting input: ${error.message}`),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingInput) {
      updateDmInputMutation.mutate({
        id: editingInput,
        inputType: formData.inputType,
        value: formData.value,
        description: formData.description,
        duration: formData.duration,
      });
    } else {
      addDmInputMutation.mutate({
        countryId: selectedCountry === "global" ? undefined : selectedCountry,
        inputType: formData.inputType,
        value: formData.value,
        description: formData.description,
        duration: formData.duration,
      });
    }
  };

  const handleEdit = (input: DmInput) => {
    setEditingInput(input.id);
    setSelectedCountry(input.countryId || "global"); // Ensure dropdown reflects edited item's scope
    setFormData({
      inputType: input.inputType as DmInputType,
      value: input.value,
      description: input.description || "",
      duration: input.duration || undefined,
    });
    setShowForm(true);
  };

  const handleDelete = (inputId: string) => {
    if (confirm("Are you sure you want to delete this DM input? This action is reversible by an admin.")) {
      deleteDmInputMutation.mutate({ id: inputId });
    }
  };

  const getInputTypeInfo = (type: string) => {
    return DM_INPUT_TYPES.find(t => t.value === type) || DM_INPUT_TYPES[0];
  };

  const getValueColor = (value: number) => {
    if (value > 0) return "text-green-600 dark:text-green-400";
    if (value < 0) return "text-red-600 dark:text-red-400";
    return "text-gray-600 dark:text-gray-400";
  };

  const formatValue = (value: number, type: string) => {
    if (type.includes("adjustment") || type.includes("modifier")) {
      return `${value > 0 ? "+" : ""}${(value * 100).toFixed(2)}%`;
    }
    return value.toFixed(4);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <Database className="h-8 w-8 mr-3 text-indigo-600 dark:text-indigo-400" />
            DM Control Dashboard
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage global economic variables and country-specific adjustments
          </p>
        </div>

        {/* Controls */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8 border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center space-x-4">
              <div>
                <label htmlFor="targetScope" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Target Scope
                </label>
                <select
                  id="targetScope"
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  disabled={editingInput !== null} // Disable if editing an existing item
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400"
                >
                  <option value="global">🌍 Global Effects</option>
                  {countriesLoading && <option disabled>Loading countries...</option>}
                  {countries?.map((country) => (
                    <option key={country.id} value={country.id}>
                       {country.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={() => {
                setShowForm(true);
                setEditingInput(null); // Clear editing state
                 // Reset form for selected country or global, keep selectedCountry
                setFormData({
                  inputType: "population_adjustment",
                  value: 0,
                  description: "",
                  countryId: selectedCountry === "global" ? undefined : selectedCountry,
                });
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-md font-medium flex items-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add DM Input
            </button>
          </div>
        </div>

        {/* DM Input Form */}
        {showForm && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8 border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {editingInput ? "Edit DM Input" : "Add New DM Input"}
              {editingInput && countries?.find(c=>c.id === formData.countryId) ? ` for ${countries?.find(c=>c.id === formData.countryId)?.name}` : (selectedCountry !== "global" && countries?.find(c=>c.id === selectedCountry) ? ` for ${countries?.find(c=>c.id === selectedCountry)?.name}` : ' (Global)')}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="inputType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Input Type
                  </label>
                  <select
                    id="inputType"
                    value={formData.inputType}
                    onChange={(e) => setFormData({ ...formData, inputType: e.target.value as DmInputType })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400"
                    required
                  >
                    {DM_INPUT_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="inputValue" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Value <span className="text-xs text-gray-400 dark:text-gray-500">(e.g., 0.05 for +5%, -0.1 for -10%)</span>
                  </label>
                  <input
                    id="inputValue"
                    type="number"
                    step="0.001"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="duration" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Duration (Years) <span className="text-xs text-gray-400 dark:text-gray-500">(Optional)</span>
                  </label>
                  <input
                    id="duration"
                    type="number"
                    step="0.1"
                    value={formData.duration || ""}
                    onChange={(e) => setFormData({ ...formData, duration: parseFloat(e.target.value) || undefined })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400"
                    placeholder="Leave empty for permanent"
                  />
                </div>
                
                { editingInput && ( // Show target only when editing, otherwise it's taken from selectedCountry
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Target
                        </label>
                        <input
                        type="text"
                        value={formData.countryId ? countries?.find(c => c.id === formData.countryId)?.name : "Global Effect"}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300"
                        />
                    </div>
                )}


              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400"
                  placeholder="Describe the effect (e.g., 'Trade war impacts', 'Natural disaster recovery')"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingInput(null);
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addDmInputMutation.isPending || updateDmInputMutation.isPending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 disabled:opacity-50 text-white rounded-md flex items-center"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {editingInput ? "Update Input" : "Add Input"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Active DM Inputs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Active DM Inputs {selectedCountry === "global" ? "(Global)" : `(${countries?.find(c => c.id === selectedCountry)?.name || '...'})`}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {inputsLoading ? 'Loading inputs...' : `${dmInputs?.length || 0} active inputs affecting economic calculations`}
            </p>
          </div>

          <div className="overflow-x-auto">
            {inputsLoading && <div className="p-6 text-center text-gray-500 dark:text-gray-400">Loading inputs...</div>}
            {!inputsLoading && dmInputs && dmInputs.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-850">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Value
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Created (IxTime)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {dmInputs.map((input: DmInput) => {
                    const typeInfo = getInputTypeInfo(input.inputType);
                    const Icon = typeInfo.icon;
                    
                    return (
                      <tr key={input.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Icon className={`h-5 w-5 mr-2 text-${typeInfo.color}-500 dark:text-${typeInfo.color}-400`} />
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {typeInfo.label}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-sm font-semibold ${getValueColor(input.value)}`}>
                            {formatValue(input.value, input.inputType)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-900 dark:text-white">
                            {input.description}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {input.duration ? (
                            <span className="flex items-center">
                              <Clock className="h-4 w-4 mr-1" />
                              {input.duration} years
                            </span>
                          ) : (
                            "Permanent"
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {IxTime.formatIxTime(input.ixTimeTimestamp.getTime())}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleEdit(input)}
                              className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 p-1 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-700"
                              aria-label="Edit Input"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(input.id)}
                              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 p-1 rounded-md hover:bg-red-100 dark:hover:bg-red-700"
                              aria-label="Delete Input"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
             !inputsLoading && (
              <div className="text-center py-12">
                <Database className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No DM inputs</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {selectedCountry === "global" 
                    ? "No global economic modifiers are currently active."
                    : "No country-specific modifiers are currently active for the selected nation."
                  }
                </p>
              </div>
             )
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              title: "Economic Crisis",
              description: "Apply -15% GDP adjustment globally",
              action: () => setFormData({
                inputType: "gdp_adjustment",
                value: -0.15,
                description: "Global economic crisis",
                duration: 2,
              }),
              color: "red",
              icon: TrendingDown,
            },
            {
              title: "Trade Boom",
              description: "Apply +10% GDP adjustment globally",
              action: () => setFormData({
                inputType: "gdp_adjustment",
                value: 0.10,
                description: "Global trade expansion",
                duration: 1,
              }),
              color: "green",
              icon: TrendingUp,
            },
            {
              title: "Technological Leap",
              description: "Apply +25% growth rate modifier",
              action: () => setFormData({
                inputType: "growth_rate_modifier",
                value: 0.25,
                description: "Major technological breakthrough",
                duration: 5,
              }),
              color: "purple",
              icon: Zap,
            },
          ].map((preset, index) => {
            const Icon = preset.icon;
            return (
              <button
                key={index}
                onClick={() => {
                  setSelectedCountry("global"); // Quick actions are global
                  preset.action();
                  setShowForm(true);
                  setEditingInput(null);
                }}
                className={`p-4 border-2 border-dashed border-${preset.color}-300 dark:border-${preset.color}-700 rounded-lg hover:border-${preset.color}-400 dark:hover:border-${preset.color}-600 transition-colors text-left bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750`}
              >
                <Icon className={`h-6 w-6 text-${preset.color}-500 dark:text-${preset.color}-400 mb-2`} />
                <h3 className={`font-medium text-${preset.color}-700 dark:text-${preset.color}-300`}>
                  {preset.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {preset.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}