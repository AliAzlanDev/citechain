"use client";

import { SeedReferencesInput } from "@/lib/types";
import { ColumnDef } from "@tanstack/react-table";
import { XCircleIcon } from "lucide-react";
import { Badge } from "../ui/badge";

export const notFoundColumns: ColumnDef<SeedReferencesInput>[] = [
  {
    accessorKey: "id",
    header: "Status",
    cell: () => {
      return (
        <Badge variant="outline" className="text-muted-foreground px-1.5">
          <XCircleIcon className="fill-red-500 text-white" />
          <span>Not Found</span>
        </Badge>
      );
    },
  },
  {
    accessorKey: "title",
    header: "Title (Input)",
    cell: ({ row }) => {
      const title = row.original.title || "N/A";
      return (
        <div className="whitespace-pre-wrap" title={title}>
          {title}
        </div>
      );
    },
  },
  {
    accessorKey: "doi",
    header: "DOI (Input)",
    cell: ({ row }) => {
      const doi = row.original.doi;
      return doi ? (
        <a
          href={`https://doi.org/${doi}`}
          target="_blank"
          rel="noopener"
          className="text-blue-600 hover:underline"
        >
          {doi}
        </a>
      ) : (
        "N/A"
      );
    },
  },
  {
    accessorKey: "pmid",
    header: "PMID (Input)",
    cell: ({ row }) => {
      const pmid = row.original.pmid;
      return pmid ? (
        <a
          href={`https://pubmed.ncbi.nlm.nih.gov/${pmid}`}
          target="_blank"
          rel="noopener"
          className="text-blue-600 hover:underline"
        >
          {pmid}
        </a>
      ) : (
        "N/A"
      );
    },
  },
  {
    accessorKey: "pmcid",
    header: "PMCID (Input)",
    cell: ({ row }) => {
      const pmcid = row.original.pmcid;
      return pmcid ? (
        <a
          href={`https://www.ncbi.nlm.nih.gov/pmc/articles/${pmcid}`}
          target="_blank"
          rel="noopener"
          className="text-blue-600 hover:underline"
        >
          {pmcid}
        </a>
      ) : (
        "N/A"
      );
    },
  },
];
