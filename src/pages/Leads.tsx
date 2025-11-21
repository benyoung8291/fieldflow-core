import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, Mail, Phone, Building2, ArrowUpDown } from "lucide-react";
import LeadDialog from "@/components/leads/LeadDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MobileDocumentCard } from "@/components/mobile/MobileDocumentCard";
import { useViewMode } from "@/contexts/ViewModeContext";
import { cn } from "@/lib/utils";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/mobile/PullToRefreshIndicator";
import { usePagination } from "@/hooks/usePagination";

export default function Leads() {
  const navigate = useNavigate();
  const { isMobile } = useViewMode();
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const pagination = usePagination({ initialPageSize: 50 });

  const { data: leadsResponse, isLoading, refetch } = useQuery({
    queryKey: ["leads", statusFilter, pagination.currentPage, pagination.pageSize],
    queryFn: async () => {
      const { from, to } = pagination.getRange();
      let query = supabase
        .from("leads")
        .select(`
          id,
          name,
          company_name,
          email,
          phone,
          status,
          rating,
          source,
          created_at,
          converted_to_customer_id
        `, { count: 'exact' })
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
  });
  
  const leads = leadsResponse?.data || [];
  const totalCount = leadsResponse?.count || 0;
  const totalPages = Math.ceil(totalCount / pagination.pageSize);

  const { containerRef, isPulling, isRefreshing, pullDistance, threshold } = usePullToRefresh({
    onRefresh: async () => {
      await refetch();
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["lead-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("status, converted_to_customer_id")
        .eq("is_active", true);

      if (error) throw error;

      const newLeads = data.filter(l => l.status === "new").length;
      const qualified = data.filter(l => l.status === "qualified").length;
      const contacted = data.filter(l => l.status === "contacted").length;
      const converted = data.filter(l => l.converted_to_customer_id !== null).length;

      return { newLeads, qualified, contacted, converted, total: data.length };
    },
  });

  const filteredLeads = leads.filter((lead) =>
    lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusColors: Record<string, string> = {
    new: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    contacted: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    qualified: "bg-green-500/10 text-green-500 border-green-500/20",
    proposal: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    negotiation: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    lost: "bg-red-500/10 text-red-500 border-red-500/20",
  };

  const ratingColors: Record<string, string> = {
    hot: "bg-red-500/10 text-red-500",
    warm: "bg-orange-500/10 text-orange-500",
    cold: "bg-blue-500/10 text-blue-500",
  };

  return (
    <DashboardLayout>
      <div ref={containerRef} className="relative h-full overflow-y-auto">
        <PullToRefreshIndicator
          isPulling={isPulling}
          isRefreshing={isRefreshing}
          pullDistance={pullDistance}
          threshold={threshold}
        />
        <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Leads</h1>
            <p className="text-muted-foreground">Manage potential customers</p>
          </div>
          <Button onClick={() => { setSelectedLeadId(undefined); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            New Lead
          </Button>
        </div>

        {stats && !isMobile && (
          <div className="grid gap-4 md:grid-cols-5">
            <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setStatusFilter("all")}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setStatusFilter("new")}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">New</CardTitle>
                <Badge variant="outline" className="bg-blue-500/10 text-blue-500">New</Badge>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.newLeads}</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setStatusFilter("contacted")}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Contacted</CardTitle>
                <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500">Active</Badge>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.contacted}</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setStatusFilter("qualified")}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Qualified</CardTitle>
                <Badge variant="outline" className="bg-green-500/10 text-green-500">Hot</Badge>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.qualified}</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:bg-muted/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Converted</CardTitle>
                <Badge variant="outline" className="bg-purple-500/10 text-purple-500">Won</Badge>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.converted}</div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          {statusFilter !== "all" && (
            <Button variant="outline" onClick={() => setStatusFilter("all")}>
              Clear Filter
            </Button>
          )}
        </div>

        <div className={cn(isMobile ? "space-y-3" : "rounded-lg border bg-card")}>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading leads...</div>
          ) : filteredLeads.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No leads found. Create your first lead to get started.
            </div>
          ) : isMobile ? (
            /* Mobile Card View */
            filteredLeads.map((lead) => (
              <MobileDocumentCard
                key={lead.id}
                title={lead.name}
                subtitle={lead.company_name}
                status={lead.status}
                statusColor={
                  lead.status === 'new' ? 'bg-blue-500' :
                  lead.status === 'contacted' ? 'bg-yellow-500' :
                  lead.status === 'qualified' ? 'bg-green-500' :
                  lead.status === 'proposal' ? 'bg-purple-500' :
                  lead.status === 'negotiation' ? 'bg-orange-500' :
                  'bg-red-500'
                }
                badge={lead.rating}
                badgeVariant={
                  lead.rating === 'hot' ? 'destructive' :
                  lead.rating === 'warm' ? 'default' :
                  'secondary'
                }
                metadata={[
                  ...(lead.email ? [{ label: 'Email', value: lead.email }] : []),
                  ...(lead.phone ? [{ label: 'Phone', value: lead.phone }] : []),
                  ...(lead.source ? [{ label: 'Source', value: lead.source }] : []),
                ]}
                onClick={() => navigate(`/leads/${lead.id}`)}
              />
            ))
          ) : (
            /* Desktop Table View */
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name / Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map((lead) => (
                  <TableRow
                    key={lead.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/leads/${lead.id}`)}
                  >
                    <TableCell>
                      <div>
                        <div className="font-medium">{lead.name}</div>
                        {lead.company_name && (
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {lead.company_name}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {lead.email && (
                          <div className="text-sm flex items-center gap-1">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            {lead.email}
                          </div>
                        )}
                        {lead.phone && (
                          <div className="text-sm flex items-center gap-1">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {lead.phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[lead.status]}>
                        {lead.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {lead.rating && (
                        <Badge variant="secondary" className={ratingColors[lead.rating]}>
                          {lead.rating}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {lead.source || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLeadId(lead.id);
                          setDialogOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        
        {/* Pagination Controls */}
        {!isMobile && totalPages > 1 && (
          <div className="mt-6 border-t pt-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {pagination.currentPage * pagination.pageSize + 1} - {Math.min((pagination.currentPage + 1) * pagination.pageSize, totalCount)} of {totalCount} leads
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => pagination.prevPage()} disabled={pagination.currentPage === 0}>
                Previous
              </Button>
              <div className="text-sm">Page {pagination.currentPage + 1} of {totalPages}</div>
              <Button variant="outline" size="sm" onClick={() => pagination.nextPage()} disabled={pagination.currentPage >= totalPages - 1}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
      </div>

      <LeadDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        leadId={selectedLeadId}
      />
    </DashboardLayout>
  );
}