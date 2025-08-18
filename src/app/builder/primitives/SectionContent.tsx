interface SectionContentProps {
  children: React.ReactNode;
  minHeight?: string;
}

export function SectionContent({ children, minHeight = "600px" }: SectionContentProps) {
  return (
    <div className="min-h-[600px]" style={{ minHeight }}>
      {children}
    </div>
  );
}