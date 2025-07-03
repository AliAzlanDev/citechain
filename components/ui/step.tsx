"use client";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState, useEffect } from "react";

interface StepProps {
  isExpanded: boolean;
  isCompleted: boolean;
  title: string;
  description: string;
  stepNumber: number;
  children: React.ReactNode;
  className?: string;
}

export function Step({
  title,
  isExpanded: controlledExpanded,
  description,
  stepNumber,
  isCompleted,
  children,
  className,
}: StepProps) {
  const [internalExpanded, setInternalExpanded] = useState(controlledExpanded);

  // Sync internal state with controlled state
  useEffect(() => {
    setInternalExpanded(controlledExpanded);
  }, [controlledExpanded]);

  // Use internal state for manual toggle, but respect controlled state initially
  const isExpanded = internalExpanded;
  return (
    <div
      className={`border rounded-lg bg-card transition-all duration-300 ${className}`}
    >
      {/* Agent Header */}
      <button
        onClick={() => {
          setInternalExpanded(!internalExpanded);
        }}
        className="w-full px-6 py-6 gap-4 font-normal text-left cursor-pointer flex items-center justify-between [&[data-state=open]>svg]:rotate-180"
      >
        <div
          className={cn(
            "flex shrink-0 items-center justify-center h-10 w-10 border rounded-full text-lg font-semibold",
            isCompleted
              ? "bg-blue-100 text-blue-600 border-blue-200"
              : "bg-muted text-sidebar-primary"
          )}
        >
          {isCompleted ? "✓" : stepNumber}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="leading-none font-semibold">{title}</div>
          {description && (
            <div className="text-muted-foreground text-sm">{description}</div>
          )}
        </div>
        {isExpanded ? (
          <ChevronDownIcon className="w-5 h-5 ml-auto shrink-0" />
        ) : (
          <ChevronRightIcon className="w-5 h-5 ml-auto shrink-0" />
        )}
      </button>
      {/* Agent Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="p-4 border-t overflow-y-auto">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                {children}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
