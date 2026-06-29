import { useId } from "react";
import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import Image from "next/image";
import OpenAlex from "@/public/openalex.png";
import S2 from "@/public/s2.png";
import { useStore } from "@/lib/store";
import { CitationSearchProvider } from "@/lib/citations";

export default function Providers() {
  const id = useId();
  const { selectedProvider, setSelectedProvider } = useStore();
  const isSemanticScholarOnly = selectedProvider === "semantic_scholar";

  const handleProviderChange = (value: string) => {
    setSelectedProvider(value as CitationSearchProvider);
  };
  return (
    <div>
      <Label className="text-base mb-2.5">Citation Indices</Label>
      <RadioGroup
        className="grid gap-4 grid-cols-1 md:grid-cols-2"
        value={selectedProvider}
        onValueChange={handleProviderChange}
      >
        <div className="border-input md:col-span-2 has-data-[state=checked]:border-primary/50 relative flex w-full items-start gap-2 rounded-md border p-4 shadow-xs outline-none">
          <RadioGroupItem
            value="both"
            id={`${id}-both`}
            aria-describedby={`${id}-both-description`}
            className="order-1 after:absolute after:inset-0"
          />
          <div className="flex grow items-center gap-3">
            <Image src={OpenAlex} alt="OpenAlex Logo" className="w-6" />
            <Image src={S2} alt="S2 Logo" className="w-9" />
            <div className="grid grow gap-2">
              <Label htmlFor={`${id}-both`}>
                Both OpenAlex and Semantic Scholar
              </Label>
              <p
                id={`${id}-both-description`}
                className="text-muted-foreground text-xs"
              >
                Search both indices followed by automatic deduplication
              </p>
            </div>
          </div>
        </div>
        {/* Radio card #1 */}
        <div className="border-input has-data-[state=checked]:border-primary/50 relative flex w-full items-start gap-2 rounded-md border p-4 shadow-xs outline-none">
          <RadioGroupItem
            value="openalex"
            id={`${id}-openalex`}
            aria-describedby={`${id}-openalex-description`}
            className="order-1 after:absolute after:inset-0"
          />
          <div className="flex grow items-center gap-3">
            <Image src={OpenAlex} alt="OpenAlex Logo" className="w-6" />
            <div className="grid grow gap-2">
              <Label htmlFor={`${id}-openalex`}>OpenAlex</Label>
              <p
                id={`${id}-openalex-description`}
                className="text-muted-foreground text-xs"
              >
                250+ million scholarly publications
              </p>
            </div>
          </div>
        </div>
        {/* Radio card #2 */}
        <div className="border-input has-data-[state=checked]:border-primary/50 relative flex w-full items-start gap-2 rounded-md border p-4 shadow-xs outline-none">
          <RadioGroupItem
            value="semantic_scholar"
            id={`${id}-semantic_scholar`}
            aria-describedby={`${id}-semantic_scholar-description`}
            className="order-1 after:absolute after:inset-0"
          />
          <div className="flex grow items-center gap-3">
            <Image src={S2} alt="S2 Logo" className="w-9" />
            <div className="grid grow gap-2">
              <Label htmlFor={`${id}-semantic_scholar`}>Semantic Scholar</Label>
              <p
                id={`${id}-semantic_scholar-description`}
                className="text-muted-foreground text-xs"
              >
                200+ million scholarly publications
              </p>
            </div>
          </div>
        </div>
      </RadioGroup>
      {isSemanticScholarOnly ? (
        <Alert className="mt-4 border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100">
          <AlertTriangle className="text-amber-700 dark:text-amber-300" />
          <AlertDescription>
            Semantic Scholar alone is not recommended for backward citation
            searching. In our evaluation, publisher-elided reference lists led
            to low standalone recall, so it should not be used as the primary
            backward-search source.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
