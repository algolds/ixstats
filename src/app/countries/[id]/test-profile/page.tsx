"use client";

import { use } from "react";
import { api } from "~/trpc/react";

interface TestProfilePageProps {
  params: Promise<{ id: string }>;
}

export default function TestProfilePage({ params }: TestProfilePageProps) {
  const { id } = use(params);
  
  console.log('Test profile - ID received:', id, typeof id);
  
  const { data: country, isLoading, error } = api.countries.getByIdWithEconomicData.useQuery({ id });
  
  if (isLoading) return <div className="p-8">Loading country data...</div>;
  if (error) return <div className="p-8 text-red-500">Error: {error.message}</div>;
  if (!country) return <div className="p-8">Country not found</div>;
  
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Test Profile: {country.name}</h1>
      <pre className="bg-gray-100 p-4 rounded text-sm">
        {JSON.stringify({ id, country: country.name, tier: country.economicTier }, null, 2)}
      </pre>
    </div>
  );
}