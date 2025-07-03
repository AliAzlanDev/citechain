"use client";

import * as React from "react";
import { CheckIcon, ClipboardIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function CiteCitechain() {
  const [hasCopied, setHasCopied] = React.useState(false);

  const [style, setStyle] = React.useState<string>("APA");

  React.useEffect(() => {
    if (hasCopied) {
      const timer = setTimeout(() => setHasCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [hasCopied]);

  const tabs = React.useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();

    // Format date as "Month Day, Year" (e.g., "July 2, 2025")
    const longDate = now.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Format date as "Day Mon. Year" (e.g., "2 Jul. 2025")
    const shortDate = now
      .toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
      .replace(",", ".");

    // Format date as "Day Month Year" (e.g., "2 July 2025")
    const harvardDate = now.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    return {
      APA: `Azlan, A., Tareen, W. F., Mirza, A. W., Ahmad, A., Rafaqat, Z., & Ahmed S. (${currentYear}). Citechain—Automated citation searching. Retrieved ${longDate}, from https://citechain.aliazlan.me`,
      MLA: `Azlan, Ali, et al. Citechain - Automated Citation Searching. https://citechain.aliazlan.me. Accessed ${shortDate}`,
      Chicago: `Azlan, Ali, Wajeeha Fatima Tareen, Abdul Wahab Mirza, Abraiz Ahmad, Zoha Rafaqat, and Sophia Ahmed. "Citechain - Automated Citation Searching." Accessed ${longDate}. https://citechain.aliazlan.me.`,
      Harvard: `Azlan A, Tareen WF, Mirza AW, et al. (${currentYear}) Citechain - automated citation searching. Available at: https://citechain.aliazlan.me (accessed ${harvardDate}).`,
    };
  }, []);

  const copyCommand = React.useCallback(() => {
    const command = tabs[style as keyof typeof tabs];

    navigator.clipboard.writeText(command);
    setHasCopied(true);
  }, [style, tabs]);

  return (
    <div className="overflow-x-auto rounded-md bg-background mt-8">
      <h2 className="text-base font-semibold px-3 py-1 pt-2">
        Want to cite CiteChain?
      </h2>
      <Tabs className="gap-0" value={style} onValueChange={setStyle}>
        <div className="border-border/50 flex items-center gap-2 border-b px-3 py-1 relative">
          <TabsList className="rounded-none bg-transparent p-0">
            {Object.entries(tabs).map(([key]) => {
              return (
                <TabsTrigger
                  key={key}
                  value={key}
                  className="data-[state=active]:bg-accent data-[state=active]:border-input h-7 border border-transparent pt-0.5 data-[state=active]:shadow-none"
                >
                  {key}
                </TabsTrigger>
              );
            })}
          </TabsList>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                data-slot="copy-button"
                size="icon"
                variant="ghost"
                className="absolute top-2 right-2 z-10 size-7 opacity-70 hover:opacity-100 focus-visible:opacity-100"
                onClick={copyCommand}
              >
                <span className="sr-only">Copy</span>
                {hasCopied ? <CheckIcon /> : <ClipboardIcon />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {hasCopied ? "Copied" : "Copy to Clipboard"}
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="no-scrollbar overflow-x-auto">
          {Object.entries(tabs).map(([key, value]) => {
            return (
              <TabsContent key={key} value={key} className="mt-0 px-4 py-3.5">
                <pre>
                  <code
                    className="relative font-mono text-sm leading-none whitespace-pre-wrap"
                    data-language="bash"
                  >
                    {value}
                  </code>
                </pre>
              </TabsContent>
            );
          })}
        </div>
      </Tabs>
    </div>
  );
}
