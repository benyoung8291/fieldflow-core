import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

interface ProjectContractsTabProps {
  projectId: string;
}

export default function ProjectContractsTab({ projectId }: ProjectContractsTabProps) {
  const { data: contracts, isLoading } = useQuery({
    queryKey: ["project-contracts", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_contracts")
        .select("*, attachment:project_attachments(file_name, file_url)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Loading contracts...</p>
        </CardContent>
      </Card>
    );
  }

  if (!contracts || contracts.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground mb-2">No contracts yet</p>
          <p className="text-sm text-muted-foreground">
            Upload a contract file in the Files tab and mark it as a contract to extract data automatically
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {contracts.map((contract) => (
        <Card key={contract.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg">
                  {contract.contract_number || "Contract"}
                </CardTitle>
                {contract.attachment && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {contract.attachment.file_name}
                  </p>
                )}
              </div>
              <Badge
                variant="outline"
                className={
                  contract.extraction_status === "completed"
                    ? "bg-green-500/10 text-green-500 border-green-500/20"
                    : contract.extraction_status === "failed"
                    ? "bg-red-500/10 text-red-500 border-red-500/20"
                    : contract.extraction_status === "processing"
                    ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                    : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                }
              >
                {contract.extraction_status === "processing" && (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                )}
                {contract.extraction_status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {contract.extraction_status === "completed" ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  {contract.contract_value && (
                    <div>
                      <p className="text-sm font-medium">Contract Value</p>
                      <p className="text-2xl font-bold text-primary">
                        ${contract.contract_value.toLocaleString()}
                      </p>
                    </div>
                  )}
                  {contract.builder_name && (
                    <div>
                      <p className="text-sm font-medium">Builder/Contractor</p>
                      <p className="text-lg">{contract.builder_name}</p>
                      {contract.builder_abn && (
                        <p className="text-sm text-muted-foreground">ABN: {contract.builder_abn}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {contract.start_date && (
                    <div>
                      <p className="text-sm font-medium">Start Date</p>
                      <p className="text-sm">{format(new Date(contract.start_date), "MMM d, yyyy")}</p>
                    </div>
                  )}
                  {contract.end_date && (
                    <div>
                      <p className="text-sm font-medium">End Date</p>
                      <p className="text-sm">{format(new Date(contract.end_date), "MMM d, yyyy")}</p>
                    </div>
                  )}
                </div>

                {contract.payment_terms && (
                  <div>
                    <p className="text-sm font-medium">Payment Terms</p>
                    <p className="text-sm text-muted-foreground">{contract.payment_terms}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {contract.retention_percentage !== null && (
                    <div>
                      <p className="text-sm font-medium">Retention</p>
                      <p className="text-sm">{contract.retention_percentage}%</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium">Variations Allowed</p>
                    <p className="text-sm">{contract.variations_allowed ? "Yes" : "No"}</p>
                  </div>
                </div>

                {contract.builder_contact && (
                  <div>
                    <p className="text-sm font-medium">Contact</p>
                    <p className="text-sm text-muted-foreground">{contract.builder_contact}</p>
                  </div>
                )}

                {contract.notes && (
                  <div>
                    <p className="text-sm font-medium">Notes</p>
                    <p className="text-sm text-muted-foreground">{contract.notes}</p>
                  </div>
                )}
              </>
            ) : contract.extraction_status === "failed" ? (
              <div className="text-center py-4">
                <p className="text-sm text-destructive mb-2">AI extraction failed</p>
                {contract.extraction_error && (
                  <p className="text-xs text-muted-foreground">{contract.extraction_error}</p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  You can manually enter contract details in the database
                </p>
              </div>
            ) : contract.extraction_status === "processing" ? (
              <div className="text-center py-4">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Extracting contract data using AI...</p>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">Waiting to process contract...</p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}