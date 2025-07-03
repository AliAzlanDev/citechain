import { useStore } from "@/lib/store";
import { Step } from "../ui/step";
import { columns } from "./columns";
import { DataTable } from "../ui/data-table";
import { Download } from "./download";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "../ui/badge";
import { useState } from "react";

export function Step3() {
  const { combined, backward, forward } = useStore();
  const hasCitationData =
    combined.length > 0 || forward.length > 0 || backward.length > 0;
  const [value, setValue] = useState("combined");

  // Step 3 should be expanded when we have citation data
  const isExpanded = hasCitationData;

  if (!hasCitationData) return null;
  return (
    <Step
      isExpanded={isExpanded}
      isCompleted={false}
      title="Download or View Citations"
      description="Download the citations in RIS format or view them in the table below."
      stepNumber={3}
    >
      <Download />
      <Tabs value={value} onValueChange={setValue} className="w-full mt-8">
        <TabsList className="w-full **:data-[slot=badge]:bg-muted-foreground/30">
          <TabsTrigger value="combined">
            Combined <Badge variant="secondary">{combined.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="backward">
            Backward <Badge variant="secondary">{backward.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="forward">
            Forward <Badge variant="secondary">{forward.length}</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {combined.length > 0 ? (
        <DataTable
          columns={columns}
          data={
            value === "combined"
              ? combined
              : value === "backward"
              ? backward
              : forward
          }
        />
      ) : null}
    </Step>
  );
}
