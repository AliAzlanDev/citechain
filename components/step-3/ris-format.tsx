import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "../ui/button";

export function RISFormat() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">RIS Format</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>RIS Format</DialogTitle>
          <DialogDescription>
            The downloaded file will be in RIS format, which is a standardized
            format for referencing articles.
          </DialogDescription>
        </DialogHeader>

        <pre className="bg-gray-100 p-4 rounded-md">
          <code>{`TY - JOUR
TI - Title of the Article
AB - Abstract of the Article
AU - Author Name
JO - Journal Name
PY - Year
VL - Volume
IS - Issue
SP - Start Page
EP - End Page
DO - Digital Object Identifier (DOI)
AN - PMID
ER - End of Reference
`}</code>
        </pre>
      </DialogContent>
    </Dialog>
  );
}
