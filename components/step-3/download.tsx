import { generateRIS } from "@/lib/generate-ris";
import { useStore } from "@/lib/store";
import { Button } from "../ui/button";
import { DownloadIcon } from "lucide-react";
import { RISFormat } from "./ris-format";

export function Download() {
  const { forward, backward, combined } = useStore();
  const downloadRIS = (type: "forward" | "backward" | "combined") => {
    const risContent = generateRIS(
      type === "forward" ? forward : type === "backward" ? backward : combined
    );
    const blob = new Blob([risContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${type}_citations_citechain.aliazlan.me.ris`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  return (
    <div className="flex justify-between">
      <div className="flex gap-4 mt-4">
        <DownloadButton
          onClick={() => downloadRIS("combined")}
          label="combined"
          count={combined.length}
        />
        <DownloadButton
          onClick={() => downloadRIS("backward")}
          label="backward"
          count={backward.length}
        />
        <DownloadButton
          onClick={() => downloadRIS("forward")}
          label="forward"
          count={forward.length}
        />
      </div>
      <RISFormat />
    </div>
  );
}

type DownloadButtonProps = React.ComponentProps<"button"> & {
  label: "forward" | "backward" | "combined";
  count: number;
};

export const DownloadButton = ({
  label,
  count,
  onClick,
}: DownloadButtonProps) => {
  return (
    <Button
      variant="outline"
      className={`h-20 w-24 flex flex-col gap-y-2 relative whitespace-normal`}
      onClick={onClick}
    >
      <div className="px-1.5 min-w-6 py-0.5 bg-primary  text-primary-foreground rounded-sm absolute -top-1.5 -left-2">
        {count}
      </div>

      <DownloadIcon className="size-5" />
      <span className=" capitalize">{label}</span>
    </Button>
  );
};
