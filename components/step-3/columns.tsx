"use client";

import { Citation } from "@/lib/types";
import { ColumnDef } from "@tanstack/react-table";

export const columns: ColumnDef<Citation>[] = [
  {
    accessorKey: "title",
    header: "Title",

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
    accessorKey: "year",
    header: "Year",
  },
  {
    accessorKey: "journal",
    header: "Journal",
    cell: ({ row }) => {
      const journal = row.original.journal || "N/A";
      return (
        <div className="whitespace-pre-wrap" title={journal}>
          {journal}
        </div>
      );
    },
  },
  {
    accessorKey: "doi",
    header: "DOI",
    cell: ({ row }) => {
      return row.original.doi ? (
        <a
          href={`https://doi.org/${row.original.doi}`}
          target="_blank"
          rel="noopener"
          className="text-blue-600 hover:underline"
        >
          Open
        </a>
      ) : (
        "N/A"
      );
    },
  },
];
