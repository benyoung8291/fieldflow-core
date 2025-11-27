import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, DollarSign, Calendar, Eye, Copy, Archive, Trash2, Lock } from "lucide-react";
import QuoteHeaderDialog from "@/components/quotes/QuoteHeaderDialog";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { MobileDocumentCard } from "@/components/mobile/MobileDocumentCard";
import { useViewMode } from "@/contexts/ViewModeContext";
import { cn } from "@/lib/utils";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/mobile/PullToRefreshIndicator";
import { usePagination } from "@/hooks/usePagination";
import { useGenericPresence } from "@/hooks/useGenericPresence";

export default function Quotes() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isMobile } = useViewMode();
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [quoteToDelete, setQuoteToDelete] = useState<any>(null);
  const pagination = usePagination({ initialPageSize: 50 });

  // Track presence for currently viewed quote (none in list view)
  useGenericPresence({
    recordId: null,
    tableName: "quotes",
    displayField: "title",
    moduleName: "Quotes",
    numberField: "quote_number",
  });

  const { data: quotesResponse, isLoading, refetch } = useQuery({
    queryKey: ["quotes", searchQuery, showArchived, statusFilter, pagination.currentPage, pagination.pageSize],
    queryFn: async () => {
      const { from, to } = pagination.getRange();
      let query = supabase
        .from("quotes")
        .select(`
          id,
          quote_number,
          title,
          total_amount,
          status,
          valid_until,
          created_at,
          is_archived,
          customer_id,
          lead_id,
          converted_to_service_order_id,
          converted_to_project_id,
          converted_to_contract_id,
          customers(name),
          leads(name)
        `, { count: 'exact' })
        .eq("is_archived", showArchived)
        .order("created_at", { ascending: false });

      // Apply status filter
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      // Apply search filter across all records
      if (searchQuery.trim()) {
        const searchLower = searchQuery.toLowerCase();
        query = query.or(`quote_number.ilike.%${searchLower}%,title.ilike.%${searchLower}%`);
      }

      // Apply pagination after filters
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      
      // Transform to match expected format
      const transformedData = (data || []).map(quote => ({
        ...quote,
        customer: quote.customers ? { name: quote.customers.name } : null,
        lead: quote.leads ? { name: quote.leads.name } : null
      }));
      
      return { data: transformedData, count: count || 0 };
    },
  });
  
  const quotes = quotesResponse?.data || [];
  const totalCount = quotesResponse?.count || 0;
  const totalPages = Math.ceil(totalCount / pagination.pageSize);

  const { containerRef, isPulling, isRefreshing, pullDistance, threshold } = usePullToRefresh({
    onRefresh: async () => {
      await refetch();
    },
  });

  // No need for client-side filtering since we're filtering in the database query

  const statusColors: Record<string, string> = {
    draft: "bg-gray-500/10 text-gray-500 border-gray-500/20",
    sent: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    approved: "bg-green-500/10 text-green-500 border-green-500/20",
    rejected: "bg-red-500/10 text-red-500 border-red-500/20",
    expired: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    converted: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  };

  const handleCreateQuote = () => {
    setDialogOpen(true);
  };

  const handleDuplicate = async (quote: any, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      // Get line items
      const { data: lineItems } = await supabase
        .from("quote_line_items")
        .select("*")
        .eq("quote_id", quote.id)
        .order("item_order");

      // Get sequential number from settings
      const { data: sequentialSetting } = await supabase
        .from("sequential_number_settings")
        .select("*")
        .eq("tenant_id", profile?.tenant_id)
        .eq("entity_type", "quote")
        .maybeSingle();

      let nextNumber = 1;
      let prefix = "QT";
      let numberLength = 5;

      if (sequentialSetting) {
        nextNumber = sequentialSetting.next_number || 1;
        prefix = sequentialSetting.prefix || "QT";
        numberLength = sequentialSetting.number_length || 5;
      }

      // Create new quote
      const newQuoteData = {
        tenant_id: profile?.tenant_id,
        customer_id: quote.customer_id,
        title: `${quote.title} (Copy)`,
        description: quote.description,
        quote_number: `${prefix}-${String(nextNumber).padStart(numberLength, "0")}`,
        subtotal: quote.subtotal,
        tax_rate: quote.tax_rate,
        tax_amount: quote.tax_amount,
        total_amount: quote.total_amount,
        notes: quote.notes,
        terms_conditions: quote.terms_conditions,
        internal_notes: quote.internal_notes,
        created_by: user.id,
        duplicated_from_quote_id: quote.id,
        status: "draft",
      };

      const { data: newQuote, error } = await supabase
        .from("quotes")
        .insert([newQuoteData])
        .select()
        .single();

      if (error) throw error;

      // Update the next number in settings
      if (sequentialSetting) {
        await supabase
          .from("sequential_number_settings")
          .update({ next_number: nextNumber + 1 })
          .eq("id", sequentialSetting.id);
      } else {
        // Create initial setting if it doesn't exist
        await supabase
          .from("sequential_number_settings")
          .insert({
            tenant_id: profile?.tenant_id,
            entity_type: "quote",
            prefix: "QT",
            next_number: 2,
            number_length: 5,
          });
      }

      // Copy line items
      if (lineItems && lineItems.length > 0) {
        const newLineItems = lineItems.map((item: any) => ({
          quote_id: newQuote.id,
          tenant_id: profile?.tenant_id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          cost_price: item.cost_price,
          margin_percentage: item.margin_percentage,
          sell_price: item.sell_price,
          line_total: item.line_total,
          item_order: item.item_order,
          parent_line_item_id: item.parent_line_item_id,
        }));

        await supabase.from("quote_line_items").insert(newLineItems);
      }

      toast({ title: "Quote duplicated successfully" });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      navigate(`/quotes/${newQuote.id}`);
    } catch (error: any) {
      toast({
        title: "Error duplicating quote",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleArchive = async (quote: any, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("quotes")
        .update({
          is_archived: !quote.is_archived,
          archived_at: !quote.is_archived ? new Date().toISOString() : null,
          archived_by: !quote.is_archived ? user.id : null,
        })
        .eq("id", quote.id);

      if (error) throw error;

      toast({ title: `Quote ${!quote.is_archived ? "archived" : "unarchived"} successfully` });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    } catch (error: any) {
      toast({
        title: "Error archiving quote",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteClick = (quote: any, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (quote.status !== "draft") {
      toast({
        title: "Cannot delete quote",
        description: "Only draft quotes can be deleted. Archive this quote instead.",
        variant: "destructive",
      });
      return;
    }

    setQuoteToDelete(quote);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!quoteToDelete) return;

    try {
      const { error } = await supabase
        .from("quotes")
        .delete()
        .eq("id", quoteToDelete.id);

      if (error) throw error;

      toast({ title: "Quote deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      setDeleteDialogOpen(false);
      setQuoteToDelete(null);
    } catch (error: any) {
      toast({
        title: "Error deleting quote",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const stats = {
    total: quotes?.length || 0,
    draft: quotes?.filter((q) => q.status === "draft").length || 0,
    sent: quotes?.filter((q) => q.status === "sent").length || 0,
    approved: quotes?.filter((q) => q.status === "approved").length || 0,
    totalValue: quotes?.reduce((sum, q) => sum + (q.total_amount || 0), 0) || 0,
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
        <div className="space-y-6 pt-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Quotes & Estimates</h1>
            <p className="text-muted-foreground">Create and manage customer quotes</p>
          </div>
          <Button onClick={handleCreateQuote}>
            <Plus className="mr-2 h-4 w-4" />
            New Quote
          </Button>
        </div>

        {!isMobile && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{stats.total}</div>
                <p className="text-xs text-muted-foreground">Total Quotes</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{stats.draft}</div>
                <p className="text-xs text-muted-foreground">Drafts</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{stats.approved}</div>
                <p className="text-xs text-muted-foreground">Approved</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">${stats.totalValue.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Total Value</p>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search quotes..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                pagination.resetPage();
              }}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={!showArchived && statusFilter === "all" ? "default" : "outline"}
              onClick={() => {
                setShowArchived(false);
                setStatusFilter("all");
              }}
              size="sm"
            >
              All
            </Button>
            <Button
              variant={!showArchived && statusFilter === "draft" ? "default" : "outline"}
              onClick={() => {
                setShowArchived(false);
                setStatusFilter("draft");
              }}
              size="sm"
            >
              Draft
            </Button>
            <Button
              variant={!showArchived && statusFilter === "sent" ? "default" : "outline"}
              onClick={() => {
                setShowArchived(false);
                setStatusFilter("sent");
              }}
              size="sm"
            >
              Sent
            </Button>
            <Button
              variant={!showArchived && statusFilter === "approved" ? "default" : "outline"}
              onClick={() => {
                setShowArchived(false);
                setStatusFilter("approved");
              }}
              size="sm"
            >
              Approved
            </Button>
            <Button
              variant={showArchived ? "default" : "outline"}
              onClick={() => setShowArchived(!showArchived)}
              size="sm"
            >
              <Archive className="mr-2 h-4 w-4" />
              Archived
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading quotes...</p>
          </div>
        ) : quotes?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">No quotes found</p>
              <Button onClick={handleCreateQuote}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Quote
              </Button>
            </CardContent>
          </Card>
        ) : isMobile ? (
          <div className="space-y-3">
            {quotes?.map((quote) => (
              <MobileDocumentCard
                key={quote.id}
                title={quote.quote_number}
                subtitle={quote.title}
                status={quote.status}
                badge={quote.customer?.name}
                metadata={[
                  { label: "Total", value: `$${quote.total_amount.toLocaleString()}` },
                  { label: "Valid Until", value: quote.valid_until ? format(new Date(quote.valid_until), "MMM d, yyyy") : "N/A" },
                ]}
                onClick={() => navigate(`/quotes/${quote.id}`)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {quotes?.map((quote) => (
              <Card
                key={quote.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(`/quotes/${quote.id}`)}
              >
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm text-muted-foreground">
                          {quote.quote_number}
                        </span>
                        <Badge variant="outline" className={statusColors[quote.status]}>
                          {quote.status}
                        </Badge>
                        {(quote.converted_to_service_order_id || quote.converted_to_project_id || quote.converted_to_contract_id) && (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <Lock className="h-3 w-3" />
                            Converted
                          </Badge>
                        )}
                        {quote.valid_until && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            Valid until {format(new Date(quote.valid_until), "MMM d, yyyy")}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{quote.title}</h3>
                        <span className="text-sm text-muted-foreground">•</span>
                        <span className="text-sm text-muted-foreground">
                          {quote.customer?.name}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-lg font-bold">
                          <DollarSign className="h-4 w-4" />
                          {quote.total_amount.toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/quotes/${quote.id}`);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => handleDuplicate(quote, e)}>
                              <Copy className="mr-2 h-4 w-4" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => handleArchive(quote, e)}>
                              <Archive className="mr-2 h-4 w-4" />
                              {quote.is_archived ? "Unarchive" : "Archive"}
                            </DropdownMenuItem>
                            {quote.status === "draft" && (
                              <DropdownMenuItem 
                                onClick={(e) => handleDeleteClick(quote, e)}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        
        {/* Pagination Controls */}
        {!isMobile && totalPages > 1 && (
          <div className="mt-6 border-t pt-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {pagination.currentPage * pagination.pageSize + 1} - {Math.min((pagination.currentPage + 1) * pagination.pageSize, totalCount)} of {totalCount} quotes
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

      <QuoteHeaderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quote</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this quote? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
