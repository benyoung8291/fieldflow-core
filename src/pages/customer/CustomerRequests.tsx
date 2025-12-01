import { CustomerPortalLayout } from "@/components/layout/CustomerPortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileText, Calendar, Link as LinkIcon, Copy, Trash2, Clock, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export default function CustomerRequests() {
  const navigate = useNavigate();
  const { data: profile } = useQuery({
    queryKey: ["customer-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("customer_portal_users")
        .select("customer_id")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["customer-tickets", profile?.customer_id],
    queryFn: async () => {
      if (!profile?.customer_id) return [];

      const { data, error } = await supabase
        .from("helpdesk_tickets")
        .select(`
          *,
          pipeline:helpdesk_pipelines(name, color),
          appointment:appointments(
            id, 
            start_time, 
            end_time, 
            status, 
            completion_reported_at, 
            completion_notes
          ),
          markups:ticket_markups(id, status)
        `)
        .eq("customer_id", profile.customer_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Calculate completion stats for each ticket
      return data.map((ticket: any) => {
        const totalMarkups = ticket.markups?.length || 0;
        const completedMarkups = ticket.markups?.filter((m: any) => m.status === "completed").length || 0;
        
        return {
          ...ticket,
          completion_progress: {
            total: totalMarkups,
            completed: completedMarkups,
            percentage: totalMarkups > 0 ? Math.round((completedMarkups / totalMarkups) * 100) : 0,
          },
        };
      });
    },
    enabled: !!profile?.customer_id,
  });

  const queryClient = useQueryClient();

  const { data: shareLinks, refetch: refetchShareLinks } = useQuery({
    queryKey: ["share-links"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("floor_plan_share_links")
        .select(`
          *,
          floor_plan:floor_plans(name, floor_number),
          location:customer_locations(name, customer_location_id)
        `)
        .eq("created_by", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const deleteLinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase
        .from("floor_plan_share_links")
        .update({ is_active: false })
        .eq("id", linkId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Share link deleted");
      refetchShareLinks();
    },
    onError: (error: any) => {
      console.error("Failed to delete share link:", error);
      toast.error("Failed to delete share link");
    },
  });

  const handleCopyLink = (token: string) => {
    const shareUrl = `${window.location.origin}/share/floor-plan/${token}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied to clipboard!");
  };

  const isExpired = (link: any) => {
    return new Date(link.expires_at) < new Date();
  };

  const isAtLimit = (link: any) => {
    return link.max_submissions && link.usage_count >= link.max_submissions;
  };

  const getExpiryText = (link: any) => {
    if (isExpired(link)) return "Expired";
    return `Expires ${formatDistanceToNow(new Date(link.expires_at), { addSuffix: true })}`;
  };

  const activeLinks = shareLinks?.filter(l => !isExpired(l) && !isAtLimit(l) && l.is_active);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return "bg-success/10 text-success border-success/20";
      case "in_progress":
        return "bg-info/10 text-info border-info/20";
      case "pending":
      case "todo":
        return "bg-warning/10 text-warning border-warning/20";
      default:
        return "bg-muted/50 text-muted-foreground border-border/40";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case "urgent":
      case "high":
        return "bg-destructive/10 text-destructive border-destructive/20";
      case "medium":
        return "bg-warning/10 text-warning border-warning/20";
      case "low":
        return "bg-success/10 text-success border-success/20";
      default:
        return "bg-muted/50 text-muted-foreground border-border/40";
    }
  };

  const formatStatus = (status: string) => {
    return status?.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) || "Unknown";
  };

  return (
    <CustomerPortalLayout>
      <div className="space-y-8">
        {/* Header Section */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">My Requests</h1>
          <p className="text-base text-muted-foreground">
            Track your service requests and their status
          </p>
        </div>

        {/* Shared Links Section */}
        {shareLinks && shareLinks.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Shared Floor Plan Links</h2>
              <Badge variant="outline" className="text-xs">
                {activeLinks?.length || 0} Active
              </Badge>
            </div>
            
            <div className="space-y-2">
              {shareLinks.map((link: any) => {
                const expired = isExpired(link);
                const atLimit = isAtLimit(link);
                const inactive = !link.is_active;
                const isInactive = expired || atLimit || inactive;

                return (
                  <Card 
                    key={link.id}
                    className={cn(
                      "border-border/40 overflow-hidden",
                      isInactive && "opacity-60"
                    )}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">
                              Floor {link.floor_plan?.floor_number} {link.floor_plan?.name} - {link.location?.name}
                            </p>
                            {expired && (
                              <Badge variant="destructive" className="text-xs">
                                Expired
                              </Badge>
                            )}
                            {atLimit && !expired && (
                              <Badge variant="secondary" className="text-xs">
                                At Limit
                              </Badge>
                            )}
                            {inactive && !expired && !atLimit && (
                              <Badge variant="secondary" className="text-xs">
                                Inactive
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>
                              {link.usage_count} / {link.max_submissions || '∞'} used
                            </span>
                            <span>•</span>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span className={expired ? "text-destructive" : ""}>
                                {getExpiryText(link)}
                              </span>
                            </div>
                          </div>
                          <Progress 
                            value={link.max_submissions ? (link.usage_count / link.max_submissions) * 100 : 0}
                            className="h-1"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          {!isInactive && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleCopyLink(link.token)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          )}
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => deleteLinkMutation.mutate(link.id)}
                            disabled={deleteLinkMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center p-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !tickets || tickets.length === 0 ? (
          <Card className="border-border/40 bg-card/50">
            <CardContent className="py-16 text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">No Requests Yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Visit a location's floor plan to create your first service request
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket: any) => (
              <Card 
                key={ticket.id}
                onClick={() => navigate(`/customer/requests/${ticket.id}`)}
                className="border-border/40 hover-lift card-interactive overflow-hidden group cursor-pointer"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-3">
                      {/* Status & Priority Badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge 
                          className={cn(
                            "rounded-lg px-3 py-1 text-xs font-semibold border",
                            getStatusColor(ticket.status)
                          )}
                        >
                          {formatStatus(ticket.status)}
                        </Badge>
                        {ticket.priority && (
                          <Badge 
                            className={cn(
                              "rounded-lg px-3 py-1 text-xs font-semibold border",
                              getPriorityColor(ticket.priority)
                            )}
                          >
                            {ticket.priority.toUpperCase()}
                          </Badge>
                        )}
                        {ticket.appointment && (
                          <Badge variant="outline" className="rounded-lg">
                            Scheduled
                          </Badge>
                        )}
                      </div>

                      {/* Title & Description */}
                      <div className="space-y-1.5">
                        <h3 className="font-semibold text-base leading-tight line-clamp-2">
                          {ticket.subject}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Request #{ticket.ticket_number}
                        </p>
                      </div>

                      {/* Meta Information */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground pt-2 border-t border-border/40">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>
                            {new Date(ticket.created_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                        {ticket.appointment?.start_time && (
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>
                              Scheduled {new Date(ticket.appointment.start_time).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                        )}
                        {/* Completion Progress */}
                        {ticket.completion_progress && ticket.completion_progress.total > 0 && (
                          <div className="flex items-center gap-1.5">
                            <CheckSquare className="h-3.5 w-3.5" />
                            <span>
                              {ticket.completion_progress.completed}/{ticket.completion_progress.total} items completed
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Completion Information */}
                      {ticket.appointment?.completion_reported_at && (
                        <div className="mt-3 p-3 bg-success/5 border border-success/20 rounded-lg space-y-2">
                          <div className="flex items-center gap-2 text-success">
                            <div className="h-2 w-2 rounded-full bg-success" />
                            <span className="text-xs font-semibold">Work Completed</span>
                          </div>
                          {ticket.appointment.completion_notes && (
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {ticket.appointment.completion_notes}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </CustomerPortalLayout>
  );
}
