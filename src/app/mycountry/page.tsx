"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "~/context/auth-context";
import { useRouter } from "next/navigation";
import { usePageTitle } from "~/hooks/usePageTitle";
import { AuthenticationGuard, CountryDataProvider, useCountryData } from "~/components/mycountry";
import { EnhancedMyCountryContent } from "~/components/mycountry/EnhancedMyCountryContent";
import { AtomicStateProvider } from "~/components/atomic/AtomicStateProvider";
import { MobileOptimized } from "./components/MobileOptimizations";
import { useMyCountryCompliance } from "~/hooks/useMyCountryCompliance";
import { MyCountryComplianceModal } from "~/components/mycountry/MyCountryComplianceModal";

export const dynamic = "force-dynamic";

// Inner component that has access to country data
function MyCountryWithAtomicState() {
  const { user } = useUser();
  const { country } = useCountryData();
  const router = useRouter();
  const { sections, isCompliant, loading: complianceLoading, countryId } = useMyCountryCompliance();
  const [showComplianceModal, setShowComplianceModal] = useState(false);

  const complianceStorageKey = useMemo(() => {
    if (!countryId) return null;
    return `ixstats:compliancePrompt:${countryId}`;
  }, [countryId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!countryId || complianceLoading || sections.length === 0) {
      return;
    }

    if (isCompliant) {
      setShowComplianceModal(false);
      if (complianceStorageKey) {
        window.localStorage.removeItem(complianceStorageKey);
      }
      return;
    }

    if (!complianceStorageKey) {
      return;
    }

    const snoozeUntilRaw = window.localStorage.getItem(complianceStorageKey);
    const snoozeUntil = snoozeUntilRaw ? Number(snoozeUntilRaw) : 0;
    if (!snoozeUntil || snoozeUntil < Date.now()) {
      setShowComplianceModal(true);
    }
  }, [countryId, complianceLoading, sections, isCompliant, complianceStorageKey]);

  const handleRemindLater = () => {
    if (typeof window !== "undefined" && complianceStorageKey) {
      const snoozeDurationMs = 1000 * 60 * 60 * 12; // 12 hours
      window.localStorage.setItem(complianceStorageKey, String(Date.now() + snoozeDurationMs));
    }
    setShowComplianceModal(false);
  };

  const handleReview = () => {
    if (typeof window !== "undefined" && complianceStorageKey) {
      window.localStorage.removeItem(complianceStorageKey);
    }
    setShowComplianceModal(false);
    router.push("/mycountry/editor");
  };

  // Set page title based on country name
  usePageTitle({
    title: country?.name ? `${country.name} - MyCountry` : "MyCountry",
  });

  const content = country?.id ? (
    <AtomicStateProvider countryId={country.id} userId={user?.id}>
      <EnhancedMyCountryContent variant="unified" title="MyCountry® - IxStats" />
    </AtomicStateProvider>
  ) : (
    <EnhancedMyCountryContent variant="unified" title="MyCountry® - IxStats" />
  );

  return (
    <>
      {content}
      {country?.id && sections.length > 0 && (
        <MyCountryComplianceModal
          open={showComplianceModal}
          sections={sections}
          onReview={handleReview}
          onRemindLater={handleRemindLater}
          onDismiss={handleRemindLater}
        />
      )}
    </>
  );
}

export default function MyCountryPage() {
  const { user } = useUser();

  return (
    <MobileOptimized enableTouchGestures={true} className="min-h-screen">
      <AuthenticationGuard redirectPath="/mycountry">
        <CountryDataProvider userId={user?.id || "placeholder-disabled"}>
          <MyCountryWithAtomicState />
        </CountryDataProvider>
      </AuthenticationGuard>
    </MobileOptimized>
  );
}
