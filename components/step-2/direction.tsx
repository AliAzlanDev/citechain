import React, { useId } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ArrowBigLeftIcon, ArrowBigRightIcon } from "lucide-react";
import { useStore } from "@/lib/store";
import { CitationDirection } from "@/lib/citations";

export default function SearchDirection() {
  const id = useId();
  const { selectedDirections, setSelectedDirections } = useStore();

  const handleDirectionChange = (
    direction: CitationDirection,
    checked: boolean
  ) => {
    if (checked) {
      if (!selectedDirections.includes(direction)) {
        setSelectedDirections([...selectedDirections, direction]);
      }
    } else {
      setSelectedDirections(selectedDirections.filter((d) => d !== direction));
    }
  };
  return (
    <div>
      <Label className="text-base">Search Direction</Label>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mt-2.5">
        <div className="border-input bg-background has-data-[state=checked]:border-primary/50 relative flex w-full items-start gap-2 rounded-md border p-4 shadow-xs outline-none">
          <Checkbox
            id={id}
            className="order-1 after:absolute after:inset-0"
            aria-describedby={`${id}-description`}
            checked={selectedDirections.includes("backward")}
            onCheckedChange={(checked) => {
              handleDirectionChange("backward", checked === true);
            }}
          />
          <div className="flex grow items-start gap-3">
            <ArrowBigLeftIcon className="size-7 shrink-0 " />
            <div className="grid gap-2">
              <Label htmlFor={id}>Backward Citations Searching</Label>
              <p
                id={`${id}-description`}
                className="text-muted-foreground text-xs"
              >
                Search for papers cited by the seed references.
              </p>
            </div>
          </div>
        </div>
        <div className="border-input bg-background has-data-[state=checked]:border-primary/50 relative flex w-full items-start gap-2 rounded-md border p-4 shadow-xs outline-none">
          <Checkbox
            id={`${id}-forward`}
            className="order-1 after:absolute after:inset-0"
            aria-describedby={`${id}-description`}
            checked={selectedDirections.includes("forward")}
            onCheckedChange={(checked) => {
              handleDirectionChange("forward", checked === true);
            }}
          />
          <div className="flex grow items-start gap-3">
            <ArrowBigRightIcon className="size-7 shrink-0 " />
            <div className="grid gap-2">
              <Label htmlFor={id}>Forward Citations Searching</Label>
              <p
                id={`${id}-description`}
                className="text-muted-foreground text-xs"
              >
                Search for papers that cite the seed references.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
