import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, MessageSquare, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface AtRiskTicket {
  id: string;
  ticket_number: string;
  subject: string;
  created_at: string;
  last_message_at: string | null;
  assigned_to: string | null;
  external_email: string | null;
  customer: { name: string } | null;
  assigned_user: { first_name: string; last_name: string } | null;
  pipeline: { name: string; color: string } | null;
  riskScore: number;
  riskReason: string;
}

export function AtRiskTickets() {
  const navigate = useNavigate();
  const [analyzingTicket, setAnalyzingTicket] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<Record<string, string>>({});

  const { data: atRiskTickets, isLoading } = useQuery({
    queryKey: ["at-risk-tickets"],
    queryFn: async () => {
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

      const { data: tickets, error } = await supabase
        .from("helpdesk_tickets")
        .select(`
          *,
          customer:customers(name),
          pipeline:helpdesk_pipelines(name, color),
          assigned_user:profiles!helpdesk_tickets_assigned_to_fkey(first_name, last_name)
        `)
        .eq("is_archived", false)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Calculate risk scores
      const riskyTickets: AtRiskTicket[] = [];

      tickets?.forEach(ticket => {
        let riskScore = 0;
        const reasons: string[] = [];

        const createdAt = new Date(ticket.created_at);
        const lastMessageAt = ticket.last_message_at ? new Date(ticket.last_message_at) : createdAt;
        const hoursSinceCreated = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
        const hoursSinceLastMessage = (now.getTime() - lastMessageAt.getTime()) / (1000 * 60 * 60);

        // Unassigned for >24h
        if (!ticket.assigned_to && hoursSinceCreated > 24) {
          riskScore += 40;
          reasons.push("Unassigned >24h");
        }

        // No reply in >48h
        if (hoursSinceLastMessage > 48) {
          riskScore += 35;
          reasons.push("No activity >48h");
        }

        // No reply in >24h
        if (hoursSinceLastMessage > 24 && hoursSinceLastMessage <= 48) {
          riskScore += 20;
          reasons.push("No activity >24h");
        }

        // Old ticket (>72h)
        if (hoursSinceCreated > 72) {
          riskScore += 25;
          reasons.push("Open >72h");
        }

        if (riskScore >= 40) {
          riskyTickets.push({
            ...ticket,
            riskScore,
            riskReason: reasons.join(", "),
          });
        }
      });

      return riskyTickets.sort((a, b) => b.riskScore - a.riskScore).slice(0, 10);
    },
  });

  const analyzeTicket = async (ticketId: string) => {
    setAnalyzingTicket(ticketId);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-ticket-risk", {
        body: { ticketId },
      });

      if (error) throw error;

      setAnalyses(prev => ({
        ...prev,
        [ticketId]: data.analysis,
      }));
    } catch (error) {
      console.error("Error analyzing ticket:", error);
    } finally {
      setAnalyzingTicket(null);
    }
  };

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="pt-6">
          <div className="h-[400px] bg-muted rounded"></div>
        </CardContent>
      </Card>
    );
  }

  if (!atRiskTickets || atRiskTickets.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-green-600" />
            At-Risk Tickets
          </CardTitle>
          <CardDescription>No tickets currently at risk of poor service</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">All tickets are being handled within acceptable timeframes.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          At-Risk Tickets
        </CardTitle>
        <CardDescription>
          Tickets requiring immediate attention to prevent poor customer experience
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {atRiskTickets.map((ticket) => (
            <Card 
              key={ticket.id} 
              className="border-l-4 hover:shadow-md transition-all cursor-pointer"
              style={{ borderLeftColor: ticket.riskScore >= 60 ? "#dc2626" : "#f97316" }}
              onClick={() => navigate(`/helpdesk?ticket=${ticket.id}`)}
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="font-mono text-xs">
                        #{ticket.ticket_number}
                      </Badge>
                      <Badge 
                        variant={ticket.riskScore >= 60 ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        Risk: {ticket.riskScore}
                      </Badge>
                      {ticket.pipeline && (
                        <Badge 
                          variant="outline" 
                          className="text-xs"
                          style={{ borderColor: ticket.pipeline.color }}
                        >
                          {ticket.pipeline.name}
                        </Badge>
                      )}
                    </div>
                    <h4 className="font-semibold text-sm mb-2">{ticket.subject}</h4>
                    <p className="text-xs text-muted-foreground mb-2">{ticket.riskReason}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {ticket.assigned_user 
                      ? `${ticket.assigned_user.first_name} ${ticket.assigned_user.last_name}`
                      : "Unassigned"}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {Math.floor((new Date().getTime() - new Date(ticket.created_at).getTime()) / (1000 * 60 * 60))}h old
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    Last: {Math.floor((new Date().getTime() - new Date(ticket.last_message_at || ticket.created_at).getTime()) / (1000 * 60 * 60))}h ago
                  </div>
                </div>

                {!analyses[ticket.id] ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      analyzeTicket(ticket.id);
                    }}
                    disabled={analyzingTicket === ticket.id}
                    className="w-full"
                  >
                    {analyzingTicket === ticket.id ? "Analyzing..." : "AI Analysis"}
                  </Button>
                ) : (
                  <div className="bg-muted/50 rounded-lg p-3 text-sm">
                    <p className="font-semibold text-xs mb-1 text-primary">AI Analysis:</p>
                    <p className="text-xs leading-relaxed">{analyses[ticket.id]}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
