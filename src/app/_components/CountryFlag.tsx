"use client";

// Simple CountryFlag component - now uses SimpleFlag
export { SimpleFlag as CountryFlag } from "~/components/SimpleFlag";

// Example usage component
export function CountryFlagExample() {
  const countries = [
    "United_States",
    "Germany", 
    "Japan",
    "France",
    "United_Kingdom"
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Country Flags Example</h3>
      <div className="flex flex-wrap gap-4">
        {countries.map((country) => (
          <div key={country} className="flex items-center gap-2">
            <CountryFlag countryName={country} size="md" />
            <span className="text-sm">{country.replace(/_/g, ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}