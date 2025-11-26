import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SeasonalAvailabilityList } from "@/components/workers/SeasonalAvailabilityList";
import { Search } from "lucide-react";

export function WorkerSeasonalAvailabilitySettings() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>("");

  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, tenant_id")
        .eq("id", user.id)
        .single();

      return profile;
    },
  });

  const { data: workers = [] } = useQuery({
    queryKey: ["workers-list", currentUser?.tenant_id],
    queryFn: async () => {
      if (!currentUser?.tenant_id) return [];

      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .eq("tenant_id", currentUser.tenant_id)
        .order("first_name");

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentUser?.tenant_id,
  });

  const filteredWorkers = workers.filter(worker => {
    const fullName = `${worker.first_name} ${worker.last_name}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Manage Worker Seasonal Availability</CardTitle>
          <CardDescription>
            View and manage seasonal availability overrides for all workers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="worker-search">Search Worker</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="worker-search"
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="worker-select">Select Worker</Label>
            <Select value={selectedWorkerId} onValueChange={setSelectedWorkerId}>
              <SelectTrigger id="worker-select">
                <SelectValue placeholder="Choose a worker..." />
              </SelectTrigger>
              <SelectContent>
                {filteredWorkers.map(worker => (
                  <SelectItem key={worker.id} value={worker.id}>
                    {worker.first_name} {worker.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedWorkerId && currentUser?.tenant_id && (
        <SeasonalAvailabilityList 
          workerId={selectedWorkerId} 
          tenantId={currentUser.tenant_id}
        />
      )}
    </div>
  );
}