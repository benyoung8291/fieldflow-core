import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { History, MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import AuditTimeline from "./AuditTimeline";

interface AuditDrawerProps {
  tableName: string;
  recordId: string;
  recordTitle?: string;
}

export default function AuditDrawer({ tableName, recordId, recordTitle }: AuditDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed top-20 right-4 z-40">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full shadow-lg bg-background border-2"
          >
            <MoreVertical className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setOpen(true)}>
            <History className="h-4 w-4 mr-2" />
            View Change History
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Change History</SheetTitle>
            {recordTitle && (
              <p className="text-sm text-muted-foreground">{recordTitle}</p>
            )}
          </SheetHeader>
          <div className="mt-6">
            <AuditTimeline tableName={tableName} recordId={recordId} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
