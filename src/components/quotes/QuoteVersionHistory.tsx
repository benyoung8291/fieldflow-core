import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, FileText, GitCompare, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import QuoteVersionComparisonDialog from "./QuoteVersionComparisonDialog";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface QuoteVersionHistoryProps {
  quoteId: string;
  canRestore?: boolean;
}

export default function QuoteVersionHistory({ quoteId, canRestore = false }: QuoteVersionHistoryProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<any>(null);
  const [versionToRestore, setVersionToRestore] = useState<any>(null);

  const { data: versions = [], isLoading } = useQuery({
    queryKey: ["quote-versions", quoteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quote_versions")
        .select("*")
        .eq("quote_id", quoteId)
        .order("version_number", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: currentQuote } = useQuery({
    queryKey: ["quote", quoteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .eq("id", quoteId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: currentLineItems = [] } = useQuery({
    queryKey: ["quote-line-items", quoteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quote_line_items")
        .select("*")
        .eq("quote_id", quoteId)
        .order("item_order");

      if (error) throw error;
      return data;
    },
  });

  const versionTypeColors = {
    conversion: "bg-success/10 text-success",
    unlock: "bg-warning/10 text-warning",
    manual: "bg-info/10 text-info",
  };

  const versionTypeLabels = {
    conversion: "Converted",
    unlock: "Unlocked",
    manual: "Manual Save",
  };

  const restoreVersionMutation = useMutation({
    mutationFn: async (version: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      // Update quote with snapshot data
      const { error: quoteError } = await supabase
        .from("quotes")
        .update({
          title: version.title,
          description: version.description,
          subtotal: version.subtotal,
          tax_rate: version.tax_rate,
          tax_amount: version.tax_amount,
          total_amount: version.total_amount,
          notes: version.notes,
          terms_conditions: version.terms_conditions,
        })
        .eq("id", quoteId);

      if (quoteError) throw quoteError;

      // Delete existing line items
      const { error: deleteError } = await supabase
        .from("quote_line_items")
        .delete()
        .eq("quote_id", quoteId);

      if (deleteError) throw deleteError;

      // Insert line items from snapshot
      const lineItemsData = version.line_items || [];
      if (lineItemsData.length > 0) {
        const { error: itemsError } = await supabase
          .from("quote_line_items")
          .insert(
            lineItemsData.map((item: any, index: number) => ({
              quote_id: quoteId,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              line_total: item.line_total,
              item_order: index,
              is_gst_free: item.is_gst_free || false,
              price_book_item_id: item.price_book_item_id,
              parent_line_item_id: item.parent_line_item_id,
              notes: item.notes,
            }))
          );

        if (itemsError) throw itemsError;
      }

      // Create new version entry for the restoration
      const { data: existingVersions } = await supabase
        .from("quote_versions")
        .select("version_number")
        .eq("quote_id", quoteId)
        .order("version_number", { ascending: false })
        .limit(1);

      const nextVersion = existingVersions && existingVersions.length > 0 
        ? existingVersions[0].version_number + 1 
        : 1;

      await supabase.from("quote_versions").insert({
        quote_id: quoteId,
        version_number: nextVersion,
        title: version.title,
        description: version.description,
        subtotal: version.subtotal,
        tax_rate: version.tax_rate,
        tax_amount: version.tax_amount,
        discount_amount: version.discount_amount,
        total_amount: version.total_amount,
        quote_type: 'manual',
        line_items: lineItemsData,
        notes: version.notes,
        terms_conditions: version.terms_conditions,
        changed_by: user.id,
        change_description: `Restored from Version ${version.version_number}`,
      } as any);

      // Add audit log
      const userName = user.user_metadata?.first_name 
        ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ""}`.trim()
        : user.email?.split("@")[0] || "System";

      await supabase.from("audit_logs").insert({
        tenant_id: profile.tenant_id,
        user_id: user.id,
        user_name: userName,
        table_name: "quotes",
        record_id: quoteId,
        action: "update",
        field_name: "version_restore",
        old_value: null,
        new_value: version.version_number.toString(),
        note: `Quote restored to Version ${version.version_number}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quote", quoteId] });
      queryClient.invalidateQueries({ queryKey: ["quote-line-items", quoteId] });
      queryClient.invalidateQueries({ queryKey: ["quote-versions", quoteId] });
      toast({ title: "Version restored successfully" });
      setRestoreDialogOpen(false);
      setVersionToRestore(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error restoring version",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Version History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading versions...</p>
        </CardContent>
      </Card>
    );
  }

  if (versions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Version History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No version history available. Versions are automatically created when a quote is converted.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Version History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {versions.map((version) => (
              <div
                key={version.id}
                className="flex items-start justify-between gap-4 rounded-lg border p-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Version {version.version_number}</span>
                    <Badge className={versionTypeColors[version.quote_type as keyof typeof versionTypeColors]}>
                      {versionTypeLabels[version.quote_type as keyof typeof versionTypeLabels]}
                    </Badge>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    <Clock className="h-3 w-3 inline mr-1" />
                    {format(new Date(version.created_at), "PPp")}
                  </div>

                  {version.change_description && (
                    <p className="text-sm text-muted-foreground">{version.change_description}</p>
                  )}

                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Subtotal: </span>
                      <span className="font-medium">${Number(version.subtotal).toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tax: </span>
                      <span className="font-medium">${Number(version.tax_amount).toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total: </span>
                      <span className="font-medium">${Number(version.total_amount).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedVersion(version);
                      setCompareDialogOpen(true);
                    }}
                  >
                    <GitCompare className="h-4 w-4 mr-2" />
                    Compare
                  </Button>
                  {canRestore && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        setVersionToRestore(version);
                        setRestoreDialogOpen(true);
                      }}
                      disabled={restoreVersionMutation.isPending}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Restore
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedVersion && currentQuote && (
        <QuoteVersionComparisonDialog
          open={compareDialogOpen}
          onOpenChange={setCompareDialogOpen}
          currentQuote={currentQuote}
          currentLineItems={currentLineItems}
          versionSnapshot={selectedVersion}
        />
      )}

      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Version {versionToRestore?.version_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore the quote to Version {versionToRestore?.version_number} from{" "}
              {versionToRestore && format(new Date(versionToRestore.created_at), "PPp")}.
              <br /><br />
              <strong>This action will:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Replace all current quote data with the snapshot</li>
                <li>Replace all line items with the snapshot line items</li>
                <li>Create a new version entry tracking this restoration</li>
              </ul>
              <br />
              You can always restore to a different version or compare versions before restoring.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => versionToRestore && restoreVersionMutation.mutate(versionToRestore)}
              disabled={restoreVersionMutation.isPending}
            >
              {restoreVersionMutation.isPending ? "Restoring..." : "Restore Version"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
