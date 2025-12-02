import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface TimeLogsFilterBarProps {
  onFilterChange: (filters: {
    workerId: string | null;
    appointmentId: string | null;
    startDate: string | null;
    endDate: string | null;
    status: string | null;
  }) => void;
}

export default function TimeLogsFilterBar({ onFilterChange }: TimeLogsFilterBarProps) {
  const [filters, setFilters] = useState({
    workerId: null as string | null,
    appointmentId: null as string | null,
    startDate: null as string | null,
    endDate: null as string | null,
    status: null as string | null,
  });

  // Fetch workers for dropdown
  const { data: workers = [] } = useQuery({
    queryKey: ["workers-for-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .order("first_name");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch appointments for dropdown
  const { data: appointments = [] } = useQuery({
    queryKey: ["appointments-for-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, title, appointment_number")
        .order("start_time", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  const handleFilterChange = (key: string, value: string | null) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearFilters = () => {
    const emptyFilters = {
      workerId: null,
      appointmentId: null,
      startDate: null,
      endDate: null,
      status: null,
    };
    setFilters(emptyFilters);
    onFilterChange(emptyFilters);
  };

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Filters</h3>
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="space-y-2">
          <Label htmlFor="worker-filter">Worker</Label>
          <Select
            value={filters.workerId || "all"}
            onValueChange={(value) => handleFilterChange("workerId", value === "all" ? null : value)}
          >
            <SelectTrigger id="worker-filter">
              <SelectValue placeholder="All Workers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Workers</SelectItem>
              {workers.map((worker) => (
                <SelectItem key={worker.id} value={worker.id}>
                  {worker.first_name} {worker.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="appointment-filter">Appointment</Label>
          <Select
            value={filters.appointmentId || "all"}
            onValueChange={(value) => handleFilterChange("appointmentId", value === "all" ? null : value)}
          >
            <SelectTrigger id="appointment-filter">
              <SelectValue placeholder="All Appointments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Appointments</SelectItem>
              {appointments.map((appointment) => (
                <SelectItem key={appointment.id} value={appointment.id}>
                  {appointment.appointment_number || appointment.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="start-date">Start Date</Label>
          <Input
            id="start-date"
            type="date"
            value={filters.startDate || ""}
            onChange={(e) => handleFilterChange("startDate", e.target.value || null)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="end-date">End Date</Label>
          <Input
            id="end-date"
            type="date"
            value={filters.endDate || ""}
            onChange={(e) => handleFilterChange("endDate", e.target.value || null)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="status-filter">Status</Label>
          <Select
            value={filters.status || "all"}
            onValueChange={(value) => handleFilterChange("status", value === "all" ? null : value)}
          >
            <SelectTrigger id="status-filter">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
