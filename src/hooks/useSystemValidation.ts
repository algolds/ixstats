"use client";

import { useState, useMemo, useCallback } from "react";
import { api } from "~/trpc/react";
import { calculateAuditSummary, type ValidationCategory } from "~/lib/system-validation";

export function useSystemValidation() {
  const [isRunning, setIsRunning] = useState(false);
  const [lastAuditTime, setLastAuditTime] = useState<string | null>(null);

  const database = api.systemValidation.checkDatabase.useQuery(undefined, {
    enabled: false,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const auth = api.systemValidation.checkAuth.useQuery(undefined, {
    enabled: false,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const ixTime = api.systemValidation.checkIxTime.useQuery(undefined, {
    enabled: false,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const economic = api.systemValidation.checkEconomicEngine.useQuery(undefined, {
    enabled: false,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const subsystems = api.systemValidation.checkSubsystems.useQuery(undefined, {
    enabled: false,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const routers = api.systemValidation.checkRouters.useQuery(undefined, {
    enabled: false,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Note: individual query references used explicitly in deps to satisfy exhaustive-deps

  const categories: ValidationCategory[] = useMemo(() => {
    const results: ValidationCategory[] = [];
    if (database.data) results.push(database.data);
    if (auth.data) results.push(auth.data);
    if (ixTime.data) results.push(ixTime.data);
    if (economic.data) results.push(economic.data);
    if (subsystems.data) results.push(subsystems.data);
    if (routers.data) results.push(routers.data);
    return results;
  }, [database.data, auth.data, ixTime.data, economic.data, subsystems.data, routers.data]);

  const allQueriesLoaded = useMemo(() => {
    if (!isRunning) return false;
    return (
      !database.isLoading &&
      !database.isFetching &&
      !auth.isLoading &&
      !auth.isFetching &&
      !ixTime.isLoading &&
      !ixTime.isFetching &&
      !economic.isLoading &&
      !economic.isFetching &&
      !subsystems.isLoading &&
      !subsystems.isFetching &&
      !routers.isLoading &&
      !routers.isFetching
    );
  }, [
    isRunning,
    database.isLoading,
    database.isFetching,
    auth.isLoading,
    auth.isFetching,
    ixTime.isLoading,
    ixTime.isFetching,
    economic.isLoading,
    economic.isFetching,
    subsystems.isLoading,
    subsystems.isFetching,
    routers.isLoading,
    routers.isFetching,
  ]);

  const summary = useMemo(() => {
    if (!allQueriesLoaded || categories.length === 0) return null;
    return calculateAuditSummary(categories);
  }, [allQueriesLoaded, categories]);

  const runAudit = useCallback(() => {
    setIsRunning(true);
    setLastAuditTime(new Date().toISOString());
    void database.refetch();
    void auth.refetch();
    void ixTime.refetch();
    void economic.refetch();
    void subsystems.refetch();
    void routers.refetch();
  }, [database, auth, ixTime, economic, subsystems, routers]);

  const isLoading = isRunning && !allQueriesLoaded;
  const progress = isRunning
    ? [database, auth, ixTime, economic, subsystems, routers].filter(
        (q) => !q.isLoading && !q.isFetching
      ).length
    : 0;

  return {
    categories,
    summary,
    isLoading,
    isRunning,
    progress,
    totalCategories: 6,
    lastAuditTime,
    runAudit,
    errors: {
      database: database.error,
      auth: auth.error,
      ixTime: ixTime.error,
      economic: economic.error,
      subsystems: subsystems.error,
      routers: routers.error,
    },
  };
}
