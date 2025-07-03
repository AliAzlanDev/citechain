import { Step } from "../ui/step";
import { DataTable } from "../ui/data-table";
import { columns } from "./columns";
import { notFoundColumns } from "./not-found-columns";
import { useStore } from "@/lib/store";
import { Button } from "../ui/button";
import SearchDirection from "./direction";
import Providers from "./providers";
import { useCitationSearch } from "@/lib/use-citation-search";
import { Label } from "../ui/label";
import { useState, useMemo } from "react";
import { ConfirmationDialog } from "../confirmation-dialog";

export function Step2() {
  const {
    seedReferences,
    originalSeedInputs,
    selectedProvider,
    selectedDirections,
    citationSearchLoading,
    combined,
    forward,
    backward,
    clearCitationData,
  } = useStore();
  const { searchCitations, hasValidInputs, validInputCount } =
    useCitationSearch();
  const hasCitationData =
    combined.length > 0 || forward.length > 0 || backward.length > 0;

  const [showResetDialog, setShowResetDialog] = useState<boolean>(false);

  // Separate found and not found references
  const foundReferences = useMemo(() => {
    return seedReferences.filter((ref) => ref.found);
  }, [seedReferences]);

  const notFoundReferences = useMemo(() => {
    // Get IDs of found references
    const foundIds = new Set(
      seedReferences.filter((ref) => ref.found).map((ref) => ref.id)
    );
    // Return original inputs that weren't found
    return originalSeedInputs.filter((input) => !foundIds.has(input.id));
  }, [seedReferences, originalSeedInputs]);

  // Step 2 should be expanded when we have seed references but no citation data
  const isExpanded = seedReferences.length > 0 && !hasCitationData;

  if (seedReferences.length === 0) {
    return;
  }

  const handleStartSearch = async () => {
    if (!hasValidInputs) {
      return;
    }

    // If we already have citation data, confirm before starting a new search
    if (hasCitationData) {
      setShowResetDialog(true);
      return;
    }

    performCitationSearch();
  };

  const performCitationSearch = async () => {
    // Determine the direction to search
    let direction: "backward" | "forward" | "both";
    if (
      selectedDirections.includes("backward") &&
      selectedDirections.includes("forward")
    ) {
      direction = "both";
    } else if (selectedDirections.includes("backward")) {
      direction = "backward";
    } else if (selectedDirections.includes("forward")) {
      direction = "forward";
    } else {
      // No direction selected, default to both
      direction = "both";
    }

    try {
      await searchCitations({
        provider: selectedProvider,
        direction: direction,
      });
    } catch (error) {
      // Error handling is done in the hook
      console.error("Citation search failed:", error);
    }
  };

  return (
    <Step
      isExpanded={isExpanded}
      isCompleted={hasCitationData}
      title="Start Citation Search"
      description="Select validated seed references to start the citation searching."
      stepNumber={2}
    >
      {seedReferences.length > 0 ? (
        <div className="space-y-6">
          {foundReferences.length > 0 && (
            <>
              <Label className="text-base mb-4">
                Found Seed References ({foundReferences.length})
              </Label>
              <DataTable columns={columns} data={foundReferences} />
            </>
          )}

          {notFoundReferences.length > 0 && (
            <>
              <Label className="text-base mb-4">
                Not Found References ({notFoundReferences.length})
              </Label>
              <DataTable columns={notFoundColumns} data={notFoundReferences} />
            </>
          )}
        </div>
      ) : null}
      <div className="mt-8 flex flex-col gap-y-4 bg-sidebar border w-full rounded-md p-4">
        <Providers />
        <SearchDirection />
        <Button
          onClick={handleStartSearch}
          disabled={
            !hasValidInputs ||
            citationSearchLoading ||
            selectedDirections.length === 0
          }
        >
          {citationSearchLoading
            ? "Searching..."
            : selectedDirections.length === 0
            ? "Select search direction to continue"
            : hasCitationData
            ? `Start new citation search with ${validInputCount} Seed References`
            : `Start Citation Search of ${validInputCount} Seed References`}
        </Button>
      </div>

      {/* Reset confirmation dialog */}
      <ConfirmationDialog
        open={showResetDialog}
        onOpenChange={setShowResetDialog}
        title="Start New Citation Search?"
        description="Starting a new citation search will delete all your current citation results. This action cannot be undone."
        cancelText="Cancel"
        confirmText={`Start New Search with ${validInputCount} Seed References`}
        confirmVariant="destructive"
        onConfirm={() => {
          clearCitationData();
          setShowResetDialog(false);
          performCitationSearch();
        }}
      />
    </Step>
  );
}
