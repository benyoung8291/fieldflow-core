import { CustomerPortalLayout } from "@/components/layout/CustomerPortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MapPin, FileText, Clock } from "lucide-react";

export default function CustomerDashboard() {
  const { data: profile } = useQuery({
    queryKey: ["customer-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("profiles")
        .select("*, customers(*)")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: locations, isLoading: locationsLoading } = useQuery({
    queryKey: ["customer-locations", profile?.customer_id],
    queryFn: async () => {
      if (!profile?.customer_id) return [];

      const { data, error } = await supabase
        .from("customer_locations")
        .select("*")
        .eq("customer_id", profile.customer_id)
        .eq("archived", false);

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.customer_id,
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ["customer-tasks", profile?.customer_id],
    queryFn: async () => {
      if (!profile?.customer_id) return [];

      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("customer_id", profile.customer_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.customer_id,
  });

  const openTasks = tasks?.filter((t) => t.status !== "completed") || [];
  const recentTasks = tasks?.slice(0, 5) || [];

  return (
    <CustomerPortalLayout>
      <div className="space-y-8">
        {/* Hero Section */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome Back
          </h1>
          <p className="text-lg text-muted-foreground">
            {profile?.customers?.name || "Loading..."}
          </p>
        </div>

        {/* Stats Cards - Apple-inspired with subtle shadows */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="border-border/40 bg-card/50 backdrop-blur-sm hover-lift overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-3xl" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                My Locations
              </CardTitle>
              <div className="rounded-full bg-primary/10 p-2">
                <MapPin className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              {locationsLoading ? (
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              ) : (
                <div className="text-3xl font-bold tracking-tight">
                  {locations?.length || 0}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/40 bg-card/50 backdrop-blur-sm hover-lift overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-warning/5 rounded-full blur-3xl" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Open Requests
              </CardTitle>
              <div className="rounded-full bg-warning/10 p-2">
                <Clock className="h-4 w-4 text-warning" />
              </div>
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <Loader2 className="h-7 w-7 animate-spin text-warning" />
              ) : (
                <div className="text-3xl font-bold tracking-tight">
                  {openTasks.length}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/40 bg-card/50 backdrop-blur-sm hover-lift overflow-hidden sm:col-span-2 lg:col-span-1">
            <div className="absolute top-0 right-0 w-24 h-24 bg-success/5 rounded-full blur-3xl" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Requests
              </CardTitle>
              <div className="rounded-full bg-success/10 p-2">
                <FileText className="h-4 w-4 text-success" />
              </div>
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <Loader2 className="h-7 w-7 animate-spin text-success" />
              ) : (
                <div className="text-3xl font-bold tracking-tight">
                  {tasks?.length || 0}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Requests - refined design */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Recent Requests</h2>
          
          {tasksLoading ? (
            <Card className="border-border/40">
              <CardContent className="flex justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </CardContent>
            </Card>
          ) : recentTasks.length === 0 ? (
            <Card className="border-border/40 bg-card/50">
              <CardContent className="text-center py-12 space-y-3">
                <div className="mx-auto w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  No requests yet. Visit a location's floor plan to create your first request.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {recentTasks.map((task) => (
                <Card 
                  key={task.id} 
                  className="border-border/40 hover-lift cursor-pointer card-interactive"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0 space-y-1">
                        <h3 className="font-medium text-sm leading-tight">
                          {task.title}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {task.description}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <time className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(task.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric'
                          })}
                        </time>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </CustomerPortalLayout>
  );
}
