"use client";

import { useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/lib/store";

// Define the form schema for manual identifiers
const identifierImportSchema = z.object({
  doi: z.string().optional(),
  pmid: z.string().optional(),
  pmcid: z.string().optional(),
  mag: z.string().optional(),
  openalex: z.string().optional(),
});

type IdentifierImportFormData = z.infer<typeof identifierImportSchema>;

export function IdentifierEntryForm() {
  const { identifierFormData, setIdentifierFormData } = useStore();

  const form = useForm<IdentifierImportFormData>({
    resolver: zodResolver(identifierImportSchema),
    defaultValues: identifierFormData || {
      doi: "",
      pmid: "",
      pmcid: "",
      mag: "",
      openalex: "",
    },
  });

  // On initial load, sync the form with store data
  useEffect(() => {
    if (identifierFormData) {
      // Only set values if they exist and aren't already set
      Object.entries(identifierFormData).forEach(([key, value]) => {
        if (value && value.trim() !== "") {
          form.setValue(key as keyof IdentifierImportFormData, value);
        }
      });
    }
  }, [form, identifierFormData]);

  const handleChange = () => {
    const data = form.getValues();
    // Store identifiers in Zustand
    setIdentifierFormData(data);
  };

  return (
    <Form {...form}>
      <form className="space-y-6 border-t pt-6 my-6">
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <FormField
            control={form.control}
            name="doi"
            render={({ field }) => (
              <FormItem>
                <FormLabel>DOI</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="10.1371/journal.pone.0266781, 10.1038/s41467-020-19171-4"
                    className="resize-y min-h-[80px]"
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      handleChange();
                    }}
                  />
                </FormControl>
                <FormDescription>
                  Enter multiple DOIs separated by commas or new lines
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="pmid"
            render={({ field }) => (
              <FormItem>
                <FormLabel>PMID</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="31734383, 35579357"
                    className="resize-y min-h-[80px]"
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      handleChange();
                    }}
                  />
                </FormControl>
                <FormDescription>
                  Enter multiple PMIDs separated by commas or new lines
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="pmcid"
            render={({ field }) => (
              <FormItem>
                <FormLabel>PMCID</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="PMC6821544, PMC8051330"
                    className="resize-y min-h-[80px]"
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      handleChange();
                    }}
                  />
                </FormControl>
                <FormDescription>
                  Enter multiple PMCIDs separated by commas or new lines
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          {/* 
          <FormField
            control={form.control}
            name="mag"
            render={({ field }) => (
              <FormItem>
                <FormLabel>MAG ID</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="2167292816, 3020418443"
                    className="resize-y min-h-[80px]"
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      handleChange();
                    }}
                  />
                </FormControl>
                <FormDescription>
                  Enter MAG IDs separated by commas or new lines
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="openalex"
            render={({ field }) => (
              <FormItem>
                <FormLabel>OpenAlex ID</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="W2741809807, W2022573213"
                    className="resize-y min-h-[80px]"
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      handleChange();
                    }}
                  />
                </FormControl>
                <FormDescription>
                  Enter OpenAlex IDs separated by commas or new lines
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          /> */}
        </div>
      </form>
    </Form>
  );
}
