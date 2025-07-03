"use client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Identifiers,
  SeedReferencesInput,
  SeedReferencesResponse,
} from "@/lib/types";
import { useState } from "react";
import { nanoid } from "nanoid";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { useStore } from "@/lib/store";
import { Step } from "../ui/step";
import { parseIdentifiers } from "@/lib/utils";
import { parseRefs } from "@/lib/parse";
import { ConfirmationDialog } from "../confirmation-dialog";
import { ReferenceUploadForm } from "./upload";
import { IdentifierEntryForm } from "./identifier";

export function Step1() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [isProcessingReferences, setIsProcessingReferences] =
    useState<boolean>(false);
  const [showResetDialog, setShowResetDialog] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);

  const {
    identifierFormData,
    uploadedFilesMeta,
    seedReferences,
    setSeedReferences,
    setOriginalSeedInputs,
    setDeduplication,
    clearStore,
  } = useStore();

  const handleFileChange = (files: File[]) => {
    setSelectedFiles(files);
    setParsingError(null);
  };

  const handleSubmit = async () => {
    // If we already have data, confirm before starting a new session
    if (seedReferences.length > 0) {
      setShowResetDialog(true);
      return;
    }

    processReferences();
  };

  const processReferences = async () => {
    setIsProcessingReferences(true);
    setParsingError(null);

    try {
      const allReferences: SeedReferencesInput[] = [];

      // Process files if any
      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          try {
            const refs = await parseRefs(file);
            allReferences.push(
              ...refs.map((ref) => ({
                id: nanoid(),
                title: ref.title,
                doi: ref.doi,
                pmid: ref.medlinePMID,
                pmcid: ref.medlinePubMedCentralID,
              }))
            );
          } catch (err) {
            console.error(`Error processing file ${file.name}:`, err);
            setParsingError(
              (prev) =>
                (prev ? `${prev}\n` : "") +
                `Error processing ${file.name}: ${
                  err instanceof Error ? err.message : String(err)
                }`
            );
          }
        }
      }

      // Process identifiers using the new utility function
      Object.entries(identifierFormData).forEach(([type, value]) => {
        if (value && value.trim()) {
          const values = parseIdentifiers(value);

          if (values.length > 0) {
            // Create reference entries for each identifier
            values.forEach((id) => {
              allReferences.push({
                id: nanoid(),
                [type as Identifiers]: id,
              });
            });
          }
        }
      });

      if (allReferences.length > 0) {
        if (allReferences.length > 100) {
          toast.warning(
            `Only the first 100 references will be processed as seed references. ${allReferences.length} references were found.`
          );
        }

        const referencesToResolve = allReferences.slice(0, 100);
        try {
          setIsValidating(true);
          const response = await fetch("/api/validate-seed-references", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ references: referencesToResolve }),
          });

          if (!response.ok) {
            let errorMessage = "Failed to validate seed references";
            try {
              const errorData = await response.json();
              errorMessage = errorData.error || errorMessage;
            } catch {
              // If JSON parsing fails, use default message
            }
            throw new Error(errorMessage);
          }

          const data = (await response.json()) as {
            results: SeedReferencesResponse[];
            deduplication: { [key in Identifiers]?: number };
          };
          setSeedReferences(data.results);
          setOriginalSeedInputs(referencesToResolve);
          setDeduplication((prev) => ({
            ...prev,
            seedDuplicates: data.deduplication,
          }));
        } catch (error) {
          console.error("Error validating seed references:", error);
          toast.error(error instanceof Error ? error.message : String(error));
        } finally {
          setIsValidating(false);
        }
      } else {
        toast.error("No references found to process");
      }
    } catch (err) {
      console.error("Processing error:", err);
      setParsingError(
        `Processing error: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setIsProcessingReferences(false);
    }
  };

  // Check if we can submit based on files or stored metadata
  const canSubmit =
    selectedFiles.length > 0 ||
    uploadedFilesMeta.length > 0 ||
    Object.values(identifierFormData).some(
      (val) => val && val.trim().length > 0
    );

  // Step 1 should be expanded only when there are no seed references
  const isExpanded = seedReferences.length === 0;

  return (
    <>
      <Step
        isExpanded={isExpanded}
        isCompleted={seedReferences.length > 0}
        title="Import Seed References"
        description="Upload files or enter DOIs/PMIDs to start with your seed references. The system will identify and resolve metadata for each reference."
        stepNumber={1}
      >
        <ReferenceUploadForm
          onFileChange={handleFileChange}
          isProcessingReferences={isProcessingReferences}
        />
        <IdentifierEntryForm />
        <Button
          onClick={handleSubmit}
          className="w-full"
          disabled={!canSubmit || isProcessingReferences || isValidating}
        >
          {isProcessingReferences
            ? "Parsing references..."
            : isValidating
            ? "Validating seed references..."
            : seedReferences.length > 0
            ? "Start new search with seed references"
            : "Process seed references"}
        </Button>
      </Step>
      {isValidating ? (
        <div className="text-center mt-8">
          <p className="text-lg font-semibold">Validating seed references...</p>
        </div>
      ) : null}

      {/* Reset confirmation dialog */}
      <ConfirmationDialog
        open={showResetDialog}
        onOpenChange={setShowResetDialog}
        title="Start New Search?"
        description="Starting a new search will delete all current citations data. This action cannot be undone."
        cancelText="Cancel"
        confirmText="Reset and Start New"
        confirmVariant="destructive"
        onConfirm={() => {
          clearStore();
          setShowResetDialog(false);
          processReferences();
        }}
      />

      {parsingError && (
        <Alert variant="destructive" className="mt-4">
          <AlertTitle>File Parsing Error</AlertTitle>
          <AlertDescription className="whitespace-pre-wrap">
            {parsingError}
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
