import { Suspense } from "react";

export const metadata = {
  title: "Messages - IxStats",
  description: "ThinkShare unified messaging across all IxStats systems",
};

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
