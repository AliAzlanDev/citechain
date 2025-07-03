"use client";
import { create } from "zustand";
import { persist, createJSONStorage, StateStorage } from "zustand/middleware";
import { get, set, del } from "idb-keyval";
import { StoreState } from "./types";

// Custom storage object for IndexedDB
const storage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await get(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      // State properties
      uploadedFilesMeta: [],
      identifierFormData: {},
      seedReferences: [],
      originalSeedInputs: [],
      backward: [],
      forward: [],
      combined: [],
      deduplication: undefined,
      citationSearchLoading: false,
      citationSearchError: null,
      // Citation search configuration
      selectedProvider: "both",
      selectedDirections: ["backward", "forward"],
      get hasCitationData() {
        return (
          this.backward.length > 0 ||
          this.forward.length > 0 ||
          this.combined.length > 0
        );
      },

      // Actions
      setUploadedFilesMeta: (files) => set({ uploadedFilesMeta: files }),

      setIdentifierFormData: (data) => set({ identifierFormData: data }),

      setSeedReferences: (references) => set({ seedReferences: references }),

      setOriginalSeedInputs: (inputs) => set({ originalSeedInputs: inputs }),

      setForward: (forward) => set({ forward }),

      setCombined: (combined) => set({ combined }),

      setBackward: (backward) => set({ backward }),

      setDeduplication: (deduplication) =>
        set((state) => ({
          deduplication:
            typeof deduplication === "function"
              ? deduplication(state.deduplication)
              : deduplication,
        })),

      setCitationResults: (results) =>
        set({
          backward: results.backward,
          forward: results.forward,
          combined: results.combined,
          deduplication: {
            backwardProviderOverlap:
              results.deduplication.backwardProviderOverlap,
            forwardProviderOverlap:
              results.deduplication.forwardProviderOverlap,
            directionOverlap: results.deduplication.directionOverlap,
          },
        }),

      setCitationSearchLoading: (loading) =>
        set({ citationSearchLoading: loading }),

      setCitationSearchError: (error) => set({ citationSearchError: error }),

      clearCitationData: () =>
        set({
          backward: [],
          forward: [],
          combined: [],
          deduplication: undefined,
          citationSearchError: null,
        }),

      setSelectedProvider: (provider) => set({ selectedProvider: provider }),

      setSelectedDirections: (directions) =>
        set({ selectedDirections: directions }),

      clearStore: () =>
        set({
          uploadedFilesMeta: [],
          identifierFormData: {},
          seedReferences: [],
          originalSeedInputs: [],
          backward: [],
          forward: [],
          combined: [],
          deduplication: undefined,
          citationSearchLoading: false,
          citationSearchError: null,
          selectedProvider: "both",
          selectedDirections: ["backward", "forward"],
        }),
    }),
    {
      name: "citechain-storage",
      storage: createJSONStorage(() => storage),
      version: 0,
    }
  )
);
