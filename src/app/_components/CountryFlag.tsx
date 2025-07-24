'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

const CountryFlag = ({
  countryCode,
  countryName,
  className,
}: {
  countryCode: string;
  countryName: string;
  className?: string;
}) => {
  // Use a root-relative path. Next.js's Image component will automatically
  // prepend the basePath. For example, this will become /projects/ixstats/flags/US.svg
  const [imgSrc, setImgSrc] = useState(`/flags/${countryCode}.svg`);

  useEffect(() => {
    // Update the src when the countryCode changes, still using a root-relative path.
    setImgSrc(`/flags/${countryCode}.svg`);
  }, [countryCode]);

  const handleError = () => {
    // The placeholder should also use a root-relative path.
    setImgSrc(`/placeholder-flag.svg`);
  };

  return (
    <Image
      src={imgSrc}
      alt={`Flag of ${countryName}`}
      width={32}
      height={24}
      className={`h-6 w-8 object-cover ${className ?? ''}`}
      onError={handleError}
      unoptimized // Useful for SVG images to prevent optimization issues
    />
  );
};

export default CountryFlag;
