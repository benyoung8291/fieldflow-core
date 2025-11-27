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
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Welcome Back</h1>
          <p className="text-muted-foreground">
            {profile?.customers?.name || "Loading..."}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">My Locations</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {locationsLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <div className="text-2xl font-bold">{locations?.length || 0}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open Requests</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <div className="text-2xl font-bold">{openTasks.length}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <div className="text-2xl font-bold">{tasks?.length || 0}</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Requests */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {tasksLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : recentTasks.length === 0 ? (
              <p className="text-center text-muted-foreground p-8">
                No requests yet. Visit a location's floor plan to create one.
              </p>
            ) : (
              <div className="space-y-4">
                {recentTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-medium">{task.title}</h3>
                    <p className="text-sm text-muted-foreground">{task.description}</p>
                  </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(task.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </CustomerPortalLayout>
  );
}
