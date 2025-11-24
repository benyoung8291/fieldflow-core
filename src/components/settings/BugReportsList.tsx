import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Bug, Calendar, User, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export function BugReportsList() {
  const navigate = useNavigate();

  const { data: bugReports, isLoading } = useQuery({
    queryKey: ["bug-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          id,
          title,
          description,
          status,
          priority,
          created_at,
          created_by,
          assigned_to,
          profiles!tasks_created_by_fkey(first_name, last_name, email)
        `)
        .eq("linked_module", "bug_report")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      
      // Transform the data to handle the profiles array
      return data?.map(report => ({
        ...report,
        profiles: Array.isArray(report.profiles) ? report.profiles[0] : report.profiles
      })) as Array<{
        id: string;
        title: string;
        description: string;
        status: string;
        priority: string;
        created_at: string;
        created_by: string;
        assigned_to: string | null;
        profiles: {
          first_name: string;
          last_name: string;
          email: string;
        };
      }>;
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500/10 text-green-500";
      case "in_progress":
        return "bg-blue-500/10 text-blue-500";
      case "pending":
        return "bg-yellow-500/10 text-yellow-500";
      default:
        return "bg-gray-500/10 text-gray-500";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-500/10 text-red-500";
      case "medium":
        return "bg-orange-500/10 text-orange-500";
      case "low":
        return "bg-green-500/10 text-green-500";
      default:
        return "bg-gray-500/10 text-gray-500";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bug className="h-5 w-5" />
          Bug Reports
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading bug reports...</div>
        ) : !bugReports || bugReports.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No bug reports found
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Reporter</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bugReports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium max-w-md">
                      <div className="truncate">{report.title}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {report.profiles.first_name && report.profiles.last_name
                            ? `${report.profiles.first_name} ${report.profiles.last_name}`
                            : report.profiles.email || "Unknown"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(report.status)}>
                        {report.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getPriorityColor(report.priority)}>
                        {report.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(report.created_at), "MMM d, yyyy")}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/tasks?highlight=${report.id}`)}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
