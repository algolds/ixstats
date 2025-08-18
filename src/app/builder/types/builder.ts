// Builder types and interfaces

export interface Section {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  description: string;
  completeness: number;
}

export interface PolicyAdvisorTip {
  id: string;
  section: string;
  type: 'warning' | 'suggestion' | 'optimization';
  title: string;
  description: string;
  impact: string;
}

export interface BuilderLayoutProps {
  builderStyle?: 'modern' | 'classic';
  builderMode?: 'basic' | 'advanced';
}

export interface SectionContentProps {
  inputs: any;
  onInputsChange: (inputs: any) => void;
  referenceCountry?: any;
  showAdvanced?: boolean;
}