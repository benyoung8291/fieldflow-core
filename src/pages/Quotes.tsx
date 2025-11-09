import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, DollarSign, Calendar, Eye } from "lucide-react";
import QuoteDialog from "@/components/quotes/QuoteDialog";
import { format } from "date-fns";

export default function Quotes() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: quotes, isLoading } = useQuery({
    queryKey: ["quotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const quotesWithCustomers = await Promise.all(
        (data || []).map(async (quote: any) => {
          const { data: customer } = await supabase
            .from("customers")
            .select("name")
            .eq("id", quote.customer_id)
            .single();

          return { ...quote, customer };
        })
      );

      return quotesWithCustomers;
    },
  });

  const filteredQuotes = quotes?.filter((quote) => {
    const matchesSearch =
      quote.quote_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      quote.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      quote.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || quote.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const statusColors: Record<string, string> = {
    draft: "bg-gray-500/10 text-gray-500 border-gray-500/20",
    sent: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    approved: "bg-green-500/10 text-green-500 border-green-500/20",
    rejected: "bg-red-500/10 text-red-500 border-red-500/20",
    expired: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    converted: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  };

  const handleCreateQuote = () => {
    setSelectedQuoteId(undefined);
    setDialogOpen(true);
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
      <div className="space-y-6">
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

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search quotes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={statusFilter === "all" ? "default" : "outline"}
              onClick={() => setStatusFilter("all")}
              size="sm"
            >
              All
            </Button>
            <Button
              variant={statusFilter === "draft" ? "default" : "outline"}
              onClick={() => setStatusFilter("draft")}
              size="sm"
            >
              Draft
            </Button>
            <Button
              variant={statusFilter === "sent" ? "default" : "outline"}
              onClick={() => setStatusFilter("sent")}
              size="sm"
            >
              Sent
            </Button>
            <Button
              variant={statusFilter === "approved" ? "default" : "outline"}
              onClick={() => setStatusFilter("approved")}
              size="sm"
            >
              Approved
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading quotes...</p>
          </div>
        ) : filteredQuotes?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">No quotes found</p>
              <Button onClick={handleCreateQuote}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Quote
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredQuotes?.map((quote) => (
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
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <QuoteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        quoteId={selectedQuoteId}
      />
    </DashboardLayout>
  );
}
