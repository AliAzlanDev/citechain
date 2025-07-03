"use client";

import { SeedReferencesResponse } from "@/lib/types";
import { ColumnDef } from "@tanstack/react-table";
import { CheckCircle2Icon, SearchIcon } from "lucide-react";
import { Badge } from "../ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const columns: ColumnDef<SeedReferencesResponse>[] = [
  {
    accessorKey: "found",
    header: "Status",
    cell: ({ row }) => {
      return (
        <div className="flex flex-col gap-1">
          <Badge variant="outline" className="text-muted-foreground px-1.5">
            <CheckCircle2Icon className="fill-green-500 text-white" />
            <span>Found</span>
          </Badge>
          {row.original.searched_by_title ? (
            <Tooltip>
              <TooltipTrigger>
                <Badge
                  variant="outline"
                  className="text-muted-foreground px-1.5"
                >
                  <SearchIcon />
                  Title Search
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Found through title search. Verify the details.</p>
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      );
    },
  },
  {
    accessorKey: "data.title",
    header: "Title",

    cell: ({ row }) => {
      const title = row.original.data?.title || "N/A";
      return (
        <div className="whitespace-pre-wrap" title={title}>
          {title}
        </div>
      );
    },
  },
  {
    accessorKey: "data.year",
    header: "Year",
  },
  {
    accessorKey: "data.journal",
    header: "Journal",
    cell: ({ row }) => {
      const journal = row.original.data?.journal || "N/A";
      return (
        <div className="whitespace-pre-wrap" title={journal}>
          {journal}
        </div>
      );
    },
  },
  {
    accessorKey: "data.doi",
    header: "DOI",
    cell: ({ row }) => {
      return row.original.data?.doi ? (
        <a
          href={`https://doi.org/${row.original.data.doi}`}
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
