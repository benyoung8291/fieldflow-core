import { useState } from "react";
import { FileText, Wrench, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import QuoteHeaderDialog from "@/components/quotes/QuoteHeaderDialog";
import ServiceOrderDialog from "@/components/service-orders/ServiceOrderDialog";

interface QuickActionsMenuProps {
  customerId?: string;
  leadId?: string;
  variant?: "default" | "outline" | "ghost";
}

export function QuickActionsMenu({ customerId, leadId, variant = "default" }: QuickActionsMenuProps) {
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [serviceOrderDialogOpen, setServiceOrderDialogOpen] = useState(false);

  // Don't render if no IDs provided
  if (!customerId && !leadId) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant={variant}>
            <Plus className="mr-2 h-4 w-4" />
            Quick Actions
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setQuoteDialogOpen(true)}>
            <FileText className="mr-2 h-4 w-4" />
            Create Quote
          </DropdownMenuItem>
          {customerId && (
            <DropdownMenuItem onClick={() => setServiceOrderDialogOpen(true)}>
              <Wrench className="mr-2 h-4 w-4" />
              Create Service Order
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <QuoteHeaderDialog
        open={quoteDialogOpen}
        onOpenChange={setQuoteDialogOpen}
        customerId={customerId}
        leadId={leadId}
      />

      {customerId && (
        <ServiceOrderDialog
          open={serviceOrderDialogOpen}
          onOpenChange={setServiceOrderDialogOpen}
          customerId={customerId}
          leadId={leadId}
        />
      )}
    </>
  );
}
