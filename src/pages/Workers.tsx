import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, MoreVertical, Users, UserCheck, UserX, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import WorkerDialog from "@/components/workers/WorkerDialog";
import PresenceIndicator from "@/components/presence/PresenceIndicator";
import RemoteCursors from "@/components/presence/RemoteCursors";
import { usePresence } from "@/hooks/usePresence";

interface Worker {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email?: string;
  phone: string | null;
  is_active: boolean;
  pay_rate_category: {
    name: string;
    hourly_rate: number;
  } | null;
}

export default function Workers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { onlineUsers, updateCursorPosition } = usePresence({ page: "workers-page" });

  const updateCursor = (e: React.MouseEvent) => {
    updateCursorPosition(e.clientX, e.clientY);
  };

  const { data: workers = [], isLoading } = useQuery({
    queryKey: ["workers"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select(`
          id,
          first_name,
          last_name,
          phone,
          is_active,
          pay_rate_category:pay_rate_categories(name, hourly_rate)
        `)
        .order("first_name");

      if (error) throw error;

      const { data: { users: authUsers } } = await supabase.auth.admin.listUsers();
      
      return ((profiles || []) as any[]).map((profile: any) => ({
        ...profile,
        email: authUsers?.find((u: any) => u.id === profile.id)?.email
      })) as Worker[];
    },
  });

  const deleteWorker = useMutation({
    mutationFn: async (workerId: string) => {
      const { error } = await supabase.auth.admin.deleteUser(workerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workers"] });
      toast.success("Worker deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete worker");
    },
  });

  const filteredWorkers = workers.filter((worker) => {
    const searchLower = searchTerm.toLowerCase();
    const fullName = `${worker.first_name || ""} ${worker.last_name || ""}`.toLowerCase();
    return (
      fullName.includes(searchLower) ||
      worker.email?.toLowerCase().includes(searchLower) ||
      worker.phone?.toLowerCase().includes(searchLower)
    );
  });

  const stats = {
    total: workers.length,
    active: workers.filter((w) => w.is_active).length,
    inactive: workers.filter((w) => !w.is_active).length,
  };

  const handleEdit = (worker: Worker) => {
    setSelectedWorker(worker);
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedWorker(null);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setSelectedWorker(null);
  };

  return (
    <DashboardLayout>
      <RemoteCursors users={onlineUsers} />
      <div className="space-y-6" onMouseMove={updateCursor}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Workers</h1>
            <p className="text-muted-foreground">Manage your workforce and their details</p>
          </div>
          <div className="flex items-center gap-2">
            <PresenceIndicator users={onlineUsers} />
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Worker
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Workers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <UserCheck className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.active}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inactive</CardTitle>
              <UserX className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.inactive}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Rate</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${(
                  workers
                    .filter((w) => w.pay_rate_category?.hourly_rate)
                    .reduce((sum, w) => sum + (w.pay_rate_category?.hourly_rate || 0), 0) /
                  workers.filter((w) => w.pay_rate_category?.hourly_rate).length || 0
                ).toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search workers..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Pay Rate</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWorkers.map((worker) => (
                    <TableRow
                      key={worker.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/workers/${worker.id}`)}
                    >
                      <TableCell className="font-medium">
                        {worker.first_name} {worker.last_name}
                      </TableCell>
                      <TableCell>{worker.email}</TableCell>
                      <TableCell>{worker.phone || "-"}</TableCell>
                      <TableCell>
                        {worker.pay_rate_category ? (
                          <div className="flex flex-col">
                            <span className="font-medium">{worker.pay_rate_category.name}</span>
                            <span className="text-sm text-muted-foreground">
                              ${worker.pay_rate_category.hourly_rate}/hr
                            </span>
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={worker.is_active ? "default" : "secondary"}>
                          {worker.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/workers/${worker.id}`);
                            }}>
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(worker);
                            }}>
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm("Are you sure you want to delete this worker?")) {
                                  deleteWorker.mutate(worker.id);
                                }
                              }}
                              className="text-destructive"
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <WorkerDialog
          open={isDialogOpen}
          onOpenChange={handleDialogClose}
          worker={selectedWorker}
        />
      </div>
    </DashboardLayout>
  );
}
