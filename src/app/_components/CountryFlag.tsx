"use client";

import React, { useState } from "react";
import { useFlag } from "~/hooks/useUnifiedFlags";

const CountryFlag = ({
  countryCode,
  countryName,
  className,
}: {
  countryCode: string;
  countryName: string;
  className?: string;
}) => {
  const { flagUrl, isLoading, error } = useFlag(countryName || countryCode);
  const [imgError, setImgError] = useState(false);

  if (isLoading) {
    return (
      <div
        className={`h-6 w-8 animate-pulse rounded-sm bg-gray-200 dark:bg-gray-700 ${className ?? ""}`}
      />
    );
  }

  if (error || imgError || !flagUrl) {
    return (
      <div
        className={`flex h-6 w-8 items-center justify-center rounded-sm bg-gray-200 dark:bg-gray-700 ${className ?? ""}`}
      >
        <span className="text-xs text-gray-500">🏴</span>
      </div>
    );
  }

  return (
    <img
      src={flagUrl}
      alt={`${countryName} flag`}
      className={`h-6 w-8 rounded-sm object-cover ${className ?? ""}`}
      onError={() => setImgError(true)}
    />
  );
};

export default CountryFlag;
