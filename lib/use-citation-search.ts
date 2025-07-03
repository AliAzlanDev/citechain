/**
 * Custom hook for citation search functionality
 */
"use client";
import { useCallback } from "react";
import { toast } from "sonner";
import { useStore } from "./store";
import {
  CitationSearchOptions,
  CitationSearchInput,
  seedReferencesToCitationInputs,
} from "./citations";

export function useCitationSearch() {
  const {
    seedReferences,
    setCitationResults,
    setCitationSearchLoading,
    setCitationSearchError,
    clearCitationData,
    citationSearchLoading,
    citationSearchError,
  } = useStore();

  const searchCitations = useCallback(
    async (
      options: CitationSearchOptions,
      customInputs?: CitationSearchInput[]
    ) => {
      try {
        setCitationSearchLoading(true);
        setCitationSearchError(null);

        // Use custom inputs or convert from seed references
        let inputs: CitationSearchInput[];
        if (customInputs) {
          inputs = customInputs;
        } else {
          inputs = seedReferencesToCitationInputs(seedReferences);
        }

        if (inputs.length === 0) {
          throw new Error(
            "No valid papers found to search citations for. Please validate some seed references first."
          );
        }

        const response = await fetch("/api/search-citations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs,
            options,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to search citations");
        }

        const { data } = await response.json();

        // Update store with results
        setCitationResults(data);

        // Show success toast
        const { statistics } = data;
        toast.success(
          `Citation search completed! Found ${statistics.totalBackward} backward, ${statistics.totalForward} forward, ${statistics.totalCombined} unique citations.`
        );

        return data;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        setCitationSearchError(errorMessage);
        toast.error(`Citation search failed: ${errorMessage}`);
        throw error;
      } finally {
        setCitationSearchLoading(false);
      }
    },
    [
      seedReferences,
      setCitationResults,
      setCitationSearchLoading,
      setCitationSearchError,
    ]
  );

  const searchBackwardCitations = useCallback(
    async (
      provider: CitationSearchOptions["provider"] = "both",
      customInputs?: CitationSearchInput[]
    ) => {
      return searchCitations({ provider, direction: "backward" }, customInputs);
    },
    [searchCitations]
  );

  const searchForwardCitations = useCallback(
    async (
      provider: CitationSearchOptions["provider"] = "both",
      customInputs?: CitationSearchInput[]
    ) => {
      return searchCitations({ provider, direction: "forward" }, customInputs);
    },
    [searchCitations]
  );

  const searchAllCitations = useCallback(
    async (
      provider: CitationSearchOptions["provider"] = "both",
      customInputs?: CitationSearchInput[]
    ) => {
      return searchCitations({ provider, direction: "both" }, customInputs);
    },
    [searchCitations]
  );

  return {
    // Actions
    searchCitations,
    searchBackwardCitations,
    searchForwardCitations,
    searchAllCitations,
    clearCitationData,

    // State
    citationSearchLoading,
    citationSearchError,

    // Computed
    hasValidInputs: seedReferences.some((ref) => ref.found && ref.data),
    validInputCount: seedReferences.filter((ref) => ref.found && ref.data)
      .length,
  };
}
