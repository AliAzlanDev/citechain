import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDropzone } from "react-dropzone";
import { X, Plus, Upload } from "lucide-react";

interface FileInputProps {
  onFilesChange?: (files: File[]) => void;
  accept?: Record<string, string[]>;
  multiple?: boolean;
  value?: File[];
  className?: string;
  disabled?: boolean;
}

const FileInput = React.forwardRef<HTMLDivElement, FileInputProps>(
  (
    {
      className,
      onFilesChange,
      accept,
      multiple = false,
      value,
      disabled = false,
      ...props
    },
    ref
  ) => {
    const [files, setFiles] = useState<File[]>(value || []);

    const onDrop = useCallback(
      (acceptedFiles: File[]) => {
        const newFiles = multiple
          ? [...files, ...acceptedFiles]
          : acceptedFiles;
        setFiles(newFiles);
        if (onFilesChange) onFilesChange(newFiles);
      },
      [files, multiple, onFilesChange]
    );

    const removeFile = (index: number) => {
      const newFiles = [...files];
      newFiles.splice(index, 1);
      setFiles(newFiles);
      if (onFilesChange) onFilesChange(newFiles);
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
      onDrop,
      accept,
      multiple,
      disabled,
    });

    // Creates an accept string from the accept object for legacy HTML input
    const getAcceptString = () => {
      if (!accept) return undefined;
      return Object.entries(accept)
        .map(([mimeType, extensions]) => [mimeType, ...extensions])
        .flat()
        .join(",");
    };

    return (
      <div
        className={cn("flex flex-wrap gap-3", className)}
        ref={ref}
        {...props}
      >
        {/* Individual file boxes */}
        {files.map((file, index) => (
          <div
            key={`${file.name}-${index}`}
            className="relative flex items-center justify-center w-24 h-24 border-2 border-input rounded-md overflow-hidden bg-background"
          >
            <div className="p-2 text-xs truncate text-center flex flex-col items-center">
              <div className="text-muted-foreground mb-1">
                {getFileIcon(file.name)}
              </div>
              <span className="truncate w-full text-center" title={file.name}>
                {file.name.length > 15
                  ? `${file.name.substring(0, 12)}...`
                  : file.name}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-0.5 right-0.5 size-4.5 rounded-full"
              onClick={() => removeFile(index)}
              disabled={disabled}
            >
              <X className="size-3 shrink-0" />
            </Button>
          </div>
        ))}

        {/* Add new file box */}
        <div
          {...getRootProps()}
          className={cn(
            "w-24 h-24 border-2 border-dashed rounded-md flex flex-col items-center justify-center cursor-pointer transition-colors",
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-input hover:border-primary/50 hover:bg-primary/5",
            disabled &&
              "opacity-50 cursor-not-allowed hover:border-input hover:bg-transparent",
            className
          )}
        >
          <input {...getInputProps()} accept={getAcceptString()} />
          <Plus className="h-8 w-8 text-muted-foreground mb-1" />
          <label className="text-xs text-muted-foreground">
            {isDragActive ? "Drop here" : "Add file"}
          </label>
        </div>
      </div>
    );
  }
);

// Helper function to show appropriate file icon
function getFileIcon(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "ris":
      return (
        <span className="flex items-center justify-center h-8 w-8 bg-blue-100 text-blue-600 rounded-full text-xs font-semibold">
          RIS
        </span>
      );
    case "nbib":
      return (
        <span className="flex items-center justify-center h-8 w-8 bg-green-100 text-green-600 rounded-full text-xs font-semibold">
          NBIB
        </span>
      );
    case "xml":
      return (
        <span className="flex items-center justify-center h-8 w-8 bg-purple-100 text-purple-600 rounded-full text-xs font-semibold">
          XML
        </span>
      );
    case "txt":
      return (
        <span className="flex items-center justify-center h-8 w-8 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold">
          TXT
        </span>
      );
    default:
      return <Upload className="h-8 w-8" />;
  }
}

FileInput.displayName = "FileInput";

export { FileInput };
