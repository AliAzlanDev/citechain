"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { UploadCloud } from "lucide-react";
import { FileInput } from "../ui/file-input";
import { useStore } from "@/lib/store";

// Define the form schema for file import
const fileImportSchema = z.object({
  files: z
    .custom<File[]>((val) => Array.isArray(val) && val.length > 0, {
      message: "Please select at least one file",
    })
    .refine(
      (files) => {
        return files.every((file) => {
          const extension = file.name.split(".").pop()?.toLowerCase();
          return ["ris", "nbib", "xml", "txt"].includes(extension || "");
        });
      },
      {
        message:
          "Only RIS, EndNote XML, and PubMed NBIB formats are supported.",
      }
    ),
});

interface ReferenceUploadFormProps {
  onFileChange: (files: File[]) => void;
  isProcessingReferences: boolean;
}

export function ReferenceUploadForm({
  onFileChange,
  isProcessingReferences,
}: ReferenceUploadFormProps) {
  const { setUploadedFilesMeta } = useStore();

  const form = useForm<z.infer<typeof fileImportSchema>>({
    resolver: zodResolver(fileImportSchema),
    defaultValues: {
      files: [],
    },
  });

  // When files are selected by the user
  const handleFileChange = (selectedFiles: File[]) => {
    // Store file metadata (since we can't store File objects directly)
    const fileMeta = selectedFiles.map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
    }));

    setUploadedFilesMeta(fileMeta);

    form.setValue("files", selectedFiles, {
      shouldValidate: true,
    });
    onFileChange(selectedFiles);
  };

  return (
    <Form {...form}>
      <form className="space-y-6">
        <FormField
          control={form.control}
          name="files"
          render={() => (
            <FormItem>
              <FormLabel>Upload Files</FormLabel>
              <FormControl>
                <div className="mt-1">
                  <FileInput
                    multiple
                    accept={{
                      "application/x-research-info-systems": [".ris"],
                      "text/plain": [".txt", ".nbib"],
                      "application/xml": [".xml"],
                    }}
                    onFilesChange={handleFileChange}
                    disabled={isProcessingReferences}
                    className="w-full"
                  />
                </div>
              </FormControl>
              <FormDescription className="flex items-center mt-2">
                <UploadCloud className="h-4 w-4 mr-1 shrink-0" />
                <span>
                  Drag and drop files or click to browse. Supported formats:
                  RIS, EndNote XML, and PubMed NBIB.
                </span>
              </FormDescription>

              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
