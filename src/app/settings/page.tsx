import { Suspense } from "react";
import { type Metadata } from "next";
import { SettingsContent, SettingsSkeleton } from "./_components/SettingsContent";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settings - IxStats",
  description:
    "Manage your diplomat identity, country preferences, wiki credentials, and notifications.",
};

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <SettingsContent />
    </Suspense>
  );
}
