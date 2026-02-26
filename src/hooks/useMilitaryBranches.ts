// src/hooks/useMilitaryBranches.ts
"use client";

import { useState, useCallback } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";

interface UseMilitaryBranchesOptions {
  countryId: string;
}

/**
 * Custom hook encapsulating all data fetching, mutations, and state management
 * for the military branches system.
 */
export function useMilitaryBranches({ countryId }: UseMilitaryBranchesOptions) {
  const notify = useNotify();
  // --- State ---
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [showBranchDialog, setShowBranchDialog] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editingBranch, setEditingBranch] = useState<any>(null);
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set());

  // --- Query ---
  const { data: branches, refetch: refetchBranches } =
    api.security.getMilitaryBranches.useQuery(
      { countryId },
      { enabled: !!countryId }
    );

  // --- Mutations ---
  const createBranch = api.security.createMilitaryBranch.useMutation({
    onSuccess: () => {
      notify.success("Military branch created successfully");
      setShowBranchDialog(false);
      setEditingBranch(null);
      refetchBranches();
    },
    onError: (error) => {
      notify.error(`Failed to create branch: ${error.message}`);
    },
  });

  const updateBranch = api.security.updateMilitaryBranch.useMutation({
    onSuccess: () => {
      notify.success("Branch updated successfully");
      setShowBranchDialog(false);
      setEditingBranch(null);
      refetchBranches();
    },
    onError: (error) => {
      notify.error(`Failed to update branch: ${error.message}`);
    },
  });

  const deleteBranch = api.security.deleteMilitaryBranch.useMutation({
    onSuccess: () => {
      notify.success("Branch deleted successfully");
      refetchBranches();
    },
    onError: (error) => {
      notify.error(`Failed to delete branch: ${error.message}`);
    },
  });

  // --- Handlers ---
  const toggleBranch = useCallback((branchId: string) => {
    setExpandedBranches((prev) => {
      const next = new Set(prev);
      if (next.has(branchId)) {
        next.delete(branchId);
      } else {
        next.add(branchId);
      }
      return next;
    });
  }, []);

  const handleCreateBranch = useCallback(() => {
    setEditingBranch(null);
    setShowBranchDialog(true);
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEditBranch = useCallback((branch: any) => {
    setEditingBranch(branch);
    setShowBranchDialog(true);
  }, []);

  const handleDeleteBranch = useCallback(
    (branchId: string) => {
      if (confirm("Are you sure you want to delete this military branch?")) {
        deleteBranch.mutate({ id: branchId });
      }
    },
    [deleteBranch]
  );

  return {
    // Data
    branches,
    refetchBranches,

    // Mutations
    createBranch,
    updateBranch,
    deleteBranch,

    // State
    selectedBranch,
    setSelectedBranch,
    showBranchDialog,
    setShowBranchDialog,
    editingBranch,
    setEditingBranch,
    expandedBranches,
    setExpandedBranches,

    // Handlers
    toggleBranch,
    handleCreateBranch,
    handleEditBranch,
    handleDeleteBranch,
  };
}
