"use client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Asterisk } from "lucide-react";
import { Step1 } from "@/components/step-1";
import { Step2 } from "@/components/step-2";
import { Step3 } from "@/components/step-3";
import { CiteCitechain } from "@/components/cite-citechain";

export default function Home() {
  return (
    <div className="mx-auto">
      <Header />
      <CiteCitechain />
      <div className="mt-8 flex flex-col gap-y-8">
        <Step1 />
        <Step2 />
        <Step3 />
      </div>
      <div className="pt-20" />
    </div>
  );
}

function Header() {
  return (
    <>
      {/* <Alert className="mb-4 border-yellow-500 bg-yellow-50 text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-300">
        <Construction className="h-4 w-4" />
        <AlertTitle>Development Status</AlertTitle>
        <AlertDescription>
          CiteChain is currently in active development. Features may change and
          some functionality might be limited.
        </AlertDescription>
      </Alert> */}
      <div className="container flex flex-col items-start gap-1 py-8 md:py-10 lg:py-12 text-foreground">
        <p className="mb-2 inline-flex items-center gap-2 px-0.5  font-medium">
          CiteChain
        </p>
        <h1 className="text-2xl font-bold leading-tight tracking-tighter sm:text-3xl md:text-4xl lg:leading-[1.1]">
          Automated Citation Searching
        </h1>
        <p className="max-w-2xl text-base font-light text-foreground sm:text-lg">
          A comprehensive citation searching tool supporting{" "}
          <strong className="font-normal">backward and forward</strong> citation
          searching with{" "}
          <strong className="font-normal">multiple citation indices</strong>{" "}
          (OpenAlex, Semantic Scholar).
        </p>
      </div>
      <Alert>
        <Asterisk className="h-4 w-4" />
        <AlertTitle>What is citation searching?</AlertTitle>
        <AlertDescription>
          Citation searching is a{" "}
          <strong className="font-medium text-primary/80">
            supplementary search method
          </strong>{" "}
          to support systematic literature reviews by identifying both{" "}
          <strong className="font-medium text-primary/80">
            cited references (backward)
          </strong>{" "}
          and{" "}
          <strong className="font-medium text-primary/80">
            citing references (forward)
          </strong>{" "}
          from seed articles.
        </AlertDescription>
      </Alert>
    </>
  );
}
