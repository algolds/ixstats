"use client";

import React from 'react';
import { CountrySymbolsUploader } from '../../CountrySymbolsUploader';

interface SymbolsUploadProps {
  flagUrl: string;
  coatOfArmsUrl: string;
  foundationCountry?: {
    name: string;
    flagUrl: string;
    coatOfArmsUrl?: string;
  };
  onSelectFlag: () => void;
  onSelectCoatOfArms: () => void;
  onFlagUrlChange: (url: string) => void;
  onCoatOfArmsUrlChange: (url: string) => void;
  onColorsExtracted: (colors: any) => void;
}

export function SymbolsUpload(props: SymbolsUploadProps) {
  return <CountrySymbolsUploader {...props} />;
}
