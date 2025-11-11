import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Mail, Phone, Building2, MapPin, UserPlus, TrendingUp, MoreVertical } from "lucide-react";
import LeadDialog from "@/components/leads/LeadDialog";
import CreateTaskButton from "@/components/tasks/CreateTaskButton";
import LinkedTasksList from "@/components/tasks/LinkedTasksList";
import { useToast } from "@/hooks/use-toast";
import { useViewMode } from "@/contexts/ViewModeContext";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { format } from "date-fns";

export default function LeadDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isMobile } = useViewMode();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);

  const { data: lead, isLoading } = useQuery({
    queryKey: ["lead", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["lead-activities", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_activities")
        .select("*")
        .eq("lead_id", id)
        .order("activity_date", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: quotes = [] } = useQuery({
    queryKey: ["lead-quotes", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .eq("lead_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const handleConvertToCustomer = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("Tenant not found");

      // Create customer from lead
      const { data: newCustomer, error: customerError } = await supabase
        .from("customers")
        .insert([{
          tenant_id: profile.tenant_id,
          name: lead!.company_name || lead!.name,
          email: lead!.email,
          phone: lead!.phone,
          address: lead!.address,
          city: lead!.city,
          state: lead!.state,
          postcode: lead!.postcode,
          notes: lead!.notes,
        }])
        .select()
        .single();

      if (customerError) throw customerError;

      // Update lead with conversion info
      const { error: updateError } = await supabase
        .from("leads")
        .update({
          converted_to_customer_id: newCustomer.id,
          converted_at: new Date().toISOString(),
          converted_by: user.id,
        })
        .eq("id", id);

      if (updateError) throw updateError;

      // Update any quotes from lead to customer
      const { error: quotesError } = await supabase
        .from("quotes")
        .update({
          customer_id: newCustomer.id,
          lead_id: null,
          is_for_lead: false,
        })
        .eq("lead_id", id);

      if (quotesError) throw quotesError;

      // Log activity
      await supabase.from("lead_activities").insert([{
        tenant_id: profile.tenant_id,
        lead_id: id!,
        activity_type: "conversion",
        subject: "Lead Converted to Customer",
        description: `Lead successfully converted to customer: ${newCustomer.name}`,
        created_by: user.id,
      }]);

      toast({ title: "Lead converted to customer successfully" });
      queryClient.invalidateQueries({ queryKey: ["lead", id] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead-stats"] });
      setConvertDialogOpen(false);

      // Navigate to customer details
      navigate(`/customers/${newCustomer.id}`);
    } catch (error: any) {
      toast({
        title: "Error converting lead",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading lead...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!lead) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Lead not found</p>
          <Button onClick={() => navigate("/leads")} className="mt-4">
            Back to Leads
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const statusColors: Record<string, string> = {
    new: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    contacted: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    qualified: "bg-green-500/10 text-green-500 border-green-500/20",
    proposal: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    negotiation: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    lost: "bg-red-500/10 text-red-500 border-red-500/20",
  };

  if (isMobile) {
    return (
      <DashboardLayout>
        <div className="flex flex-col h-full">
          {/* Mobile Header */}
          <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/leads")}
                  className="shrink-0"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1 min-w-0">
                  <h1 className="font-semibold truncate">{lead.name}</h1>
                  {lead.company_name && (
                    <p className="text-xs text-muted-foreground truncate">{lead.company_name}</p>
                  )}
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="shrink-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {!lead.converted_to_customer_id && (
                    <DropdownMenuItem onClick={() => setConvertDialogOpen(true)}>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Convert to Customer
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => setDialogOpen(true)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <div className="space-y-4 p-4">
              <div className="flex gap-2">
                <Badge variant="outline" className={statusColors[lead.status]}>
                  {lead.status}
                </Badge>
                {lead.rating && (
                  <Badge variant="secondary">
                    {lead.rating}
                  </Badge>
                )}
              </div>

              {lead.converted_to_customer_id && (
                <Card className="border-green-500/50 bg-green-500/5">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 text-green-600">
                      <TrendingUp className="h-5 w-5" />
                      <span className="font-medium text-sm">
                        This lead has been converted to a customer
                      </span>
                    </div>
                    {lead.converted_at && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Converted on {format(new Date(lead.converted_at), "PPP")}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              <Accordion type="multiple" defaultValue={["contact", "notes"]} className="space-y-2">
                <AccordionItem value="contact">
                  <AccordionTrigger className="text-base font-semibold">
                    Contact Information
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pt-2">
                      {lead.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <a href={`mailto:${lead.email}`} className="text-sm hover:underline">
                            {lead.email}
                          </a>
                        </div>
                      )}
                      {lead.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <a href={`tel:${lead.phone}`} className="text-sm hover:underline">
                            {lead.phone}
                          </a>
                        </div>
                      )}
                      {lead.mobile && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <a href={`tel:${lead.mobile}`} className="text-sm hover:underline">
                            {lead.mobile} (Mobile)
                          </a>
                        </div>
                      )}
                      {(lead.address || lead.city || lead.state) && (
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div className="text-sm">
                            {lead.address && <div>{lead.address}</div>}
                            {(lead.city || lead.state || lead.postcode) && (
                              <div>
                                {lead.city} {lead.state} {lead.postcode}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {lead.source && (
                        <div className="pt-2 border-t">
                          <p className="text-sm text-muted-foreground">Source</p>
                          <p className="text-sm font-medium capitalize">{lead.source.replace('_', ' ')}</p>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="notes">
                  <AccordionTrigger className="text-base font-semibold">
                    Notes
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm whitespace-pre-wrap">{lead.notes || "No notes"}</p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="quotes">
                  <AccordionTrigger className="text-base font-semibold">
                    Quotes ({quotes.length})
                  </AccordionTrigger>
                  <AccordionContent>
                    {quotes.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No quotes yet</p>
                    ) : (
                      <div className="space-y-2">
                        {quotes.map((quote) => (
                          <div
                            key={quote.id}
                            className="p-3 border rounded-lg active:bg-muted/50"
                            onClick={() => navigate(`/quotes/${quote.id}`)}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-sm">{quote.title}</p>
                                <p className="text-xs text-muted-foreground">{quote.quote_number}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium text-sm">${Number(quote.total_amount).toFixed(2)}</p>
                                <Badge variant="outline" className="text-xs">{quote.status}</Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="activity">
                  <AccordionTrigger className="text-base font-semibold">
                    Activity Timeline
                  </AccordionTrigger>
                  <AccordionContent>
                    {activities.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No activities yet</p>
                    ) : (
                      <div className="space-y-4">
                        {activities.map((activity) => (
                          <div key={activity.id} className="flex gap-3 border-l-2 pl-4 pb-4">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{activity.subject}</p>
                              {activity.description && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {activity.description}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground mt-2">
                                {format(new Date(activity.activity_date), "PPP p")}
                              </p>
                            </div>
                            <Badge variant="outline" className="h-fit text-xs">
                              {activity.activity_type}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="tasks">
                  <AccordionTrigger className="text-base font-semibold">
                    Tasks
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="flex justify-end mb-3">
                      <CreateTaskButton
                        linkedModule="lead"
                        linkedRecordId={id!}
                        variant="default"
                        size="sm"
                      />
                    </div>
                    <LinkedTasksList linkedModule="lead" linkedRecordId={id!} />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>
        </div>

        <LeadDialog open={dialogOpen} onOpenChange={setDialogOpen} leadId={id} />

        <AlertDialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Convert Lead to Customer</AlertDialogTitle>
              <AlertDialogDescription>
                This will create a new customer record with all the lead information. Any quotes
                associated with this lead will be transferred to the new customer. This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConvertToCustomer}>
                Convert to Customer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/leads")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{lead.name}</h1>
              <Badge variant="outline" className={statusColors[lead.status]}>
                {lead.status}
              </Badge>
              {lead.rating && (
                <Badge variant="secondary">
                  {lead.rating}
                </Badge>
              )}
            </div>
            {lead.company_name && (
              <p className="text-muted-foreground flex items-center gap-1">
                <Building2 className="h-4 w-4" />
                {lead.company_name}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {!lead.converted_to_customer_id && (
              <Button onClick={() => setConvertDialogOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Convert to Customer
              </Button>
            )}
            <Button variant="outline" onClick={() => setDialogOpen(true)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </div>
        </div>

        {lead.converted_to_customer_id && (
          <Card className="border-green-500/50 bg-green-500/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-green-600">
                <TrendingUp className="h-5 w-5" />
                <span className="font-medium">
                  This lead has been converted to a customer
                </span>
              </div>
              {lead.converted_at && (
                <p className="text-sm text-muted-foreground mt-2">
                  Converted on {format(new Date(lead.converted_at), "PPP")}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {lead.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${lead.email}`} className="text-sm hover:underline">
                    {lead.email}
                  </a>
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${lead.phone}`} className="text-sm hover:underline">
                    {lead.phone}
                  </a>
                </div>
              )}
              {lead.mobile && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${lead.mobile}`} className="text-sm hover:underline">
                    {lead.mobile} (Mobile)
                  </a>
                </div>
              )}
              {(lead.address || lead.city || lead.state) && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="text-sm">
                    {lead.address && <div>{lead.address}</div>}
                    {(lead.city || lead.state || lead.postcode) && (
                      <div>
                        {lead.city} {lead.state} {lead.postcode}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {lead.source && (
                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground">Source</p>
                  <p className="text-sm font-medium capitalize">{lead.source.replace('_', ' ')}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{lead.notes || "No notes"}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quotes ({quotes.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {quotes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No quotes yet</p>
            ) : (
              <div className="space-y-2">
                {quotes.map((quote) => (
                  <div
                    key={quote.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => navigate(`/quotes/${quote.id}`)}
                  >
                    <div>
                      <p className="font-medium">{quote.title}</p>
                      <p className="text-sm text-muted-foreground">{quote.quote_number}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${Number(quote.total_amount).toFixed(2)}</p>
                      <Badge variant="outline">{quote.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activities yet</p>
            ) : (
              <div className="space-y-4">
                {activities.map((activity) => (
                  <div key={activity.id} className="flex gap-3 border-l-2 pl-4 pb-4">
                    <div className="flex-1">
                      <p className="font-medium">{activity.subject}</p>
                      {activity.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {activity.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {format(new Date(activity.activity_date), "PPP p")}
                      </p>
                    </div>
                    <Badge variant="outline" className="h-fit">
                      {activity.activity_type}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Tasks</CardTitle>
              <CreateTaskButton
                linkedModule="lead"
                linkedRecordId={id!}
                variant="default"
                size="sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            <LinkedTasksList linkedModule="lead" linkedRecordId={id!} />
          </CardContent>
        </Card>
      </div>

      <LeadDialog open={dialogOpen} onOpenChange={setDialogOpen} leadId={id} />

      <AlertDialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Convert Lead to Customer</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a new customer record with all the lead information. Any quotes
              associated with this lead will be transferred to the new customer. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConvertToCustomer}>
              Convert to Customer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}