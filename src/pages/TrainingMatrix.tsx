import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Search, Filter } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function TrainingMatrix() {
  const [searchTerm, setSearchTerm] = useState("");
  const [skillFilter, setSkillFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { data: workers = [] } = useQuery({
    queryKey: ["workers-training"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          id,
          first_name,
          last_name,
          is_active
        `)
        .eq("is_active", true)
        .order("first_name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: skills = [] } = useQuery({
    queryKey: ["skills-for-matrix"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skills")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: workerSkills = [] } = useQuery({
    queryKey: ["worker-skills-matrix"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("worker_skills")
        .select(`
          *,
          skill:skills(name, category)
        `);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: certificates = [] } = useQuery({
    queryKey: ["worker-certificates-matrix"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("worker_certificates")
        .select("*");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: licenses = [] } = useQuery({
    queryKey: ["worker-licenses-matrix"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("worker_licenses")
        .select("*");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: training = [] } = useQuery({
    queryKey: ["worker-training-matrix"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("worker_training")
        .select("*");
      if (error) throw error;
      return data || [];
    },
  });

  const getWorkerSkills = (workerId: string) => {
    return workerSkills.filter((ws: any) => ws.worker_id === workerId);
  };

  const getWorkerCertificates = (workerId: string) => {
    return certificates.filter((c: any) => c.worker_id === workerId);
  };

  const getWorkerLicenses = (workerId: string) => {
    return licenses.filter((l: any) => l.worker_id === workerId);
  };

  const getWorkerTraining = (workerId: string) => {
    return training.filter((t: any) => t.worker_id === workerId);
  };

  const exportToCSV = () => {
    const headers = ["Worker", "Skills", "Certificates", "Licenses", "Training"];
    const rows = workers.map((worker: any) => {
      const workerName = `${worker.first_name} ${worker.last_name}`;
      const skillsList = getWorkerSkills(worker.id)
        .map((ws: any) => ws.skill?.name)
        .join("; ");
      const certsList = getWorkerCertificates(worker.id)
        .map((c: any) => c.certificate_name)
        .join("; ");
      const licensesList = getWorkerLicenses(worker.id)
        .map((l: any) => l.license_name)
        .join("; ");
      const trainingList = getWorkerTraining(worker.id)
        .map((t: any) => t.training_name)
        .join("; ");
      return [workerName, skillsList, certsList, licensesList, trainingList];
    });

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `training-matrix-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  const filteredWorkers = workers.filter((worker: any) => {
    const workerName = `${worker.first_name} ${worker.last_name}`.toLowerCase();
    return workerName.includes(searchTerm.toLowerCase());
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Training Matrix</h1>
            <p className="text-muted-foreground">
              View worker skills, certifications, licenses, and training
            </p>
          </div>
          <Button onClick={exportToCSV}>
            <Download className="mr-2 h-4 w-4" />
            Export to CSV
          </Button>
        </div>

        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search workers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={skillFilter} onValueChange={setSkillFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by skill" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Skills</SelectItem>
              {skills.map((skill: any) => (
                <SelectItem key={skill.id} value={skill.id}>
                  {skill.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="skills">Skills</TabsTrigger>
            <TabsTrigger value="certificates">Certificates</TabsTrigger>
            <TabsTrigger value="licenses">Licenses</TabsTrigger>
            <TabsTrigger value="training">Training</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead>Skills</TableHead>
                  <TableHead>Certificates</TableHead>
                  <TableHead>Licenses</TableHead>
                  <TableHead>Training</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWorkers.map((worker: any) => {
                  const workerSkillsList = getWorkerSkills(worker.id);
                  const workerCertsList = getWorkerCertificates(worker.id);
                  const workerLicensesList = getWorkerLicenses(worker.id);
                  const workerTrainingList = getWorkerTraining(worker.id);

                  return (
                    <TableRow key={worker.id}>
                      <TableCell className="font-medium">
                        {worker.first_name} {worker.last_name}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {workerSkillsList.map((ws: any) => (
                            <Badge key={ws.id} variant="outline">
                              {ws.skill?.name}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>{workerCertsList.length}</TableCell>
                      <TableCell>{workerLicensesList.length}</TableCell>
                      <TableCell>{workerTrainingList.length}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="skills" className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead>Skill</TableHead>
                  <TableHead>Proficiency</TableHead>
                  <TableHead>Date Acquired</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWorkers.flatMap((worker: any) =>
                  getWorkerSkills(worker.id).map((ws: any) => (
                    <TableRow key={ws.id}>
                      <TableCell>
                        {worker.first_name} {worker.last_name}
                      </TableCell>
                      <TableCell>{ws.skill?.name}</TableCell>
                      <TableCell>
                        <Badge>{ws.proficiency_level}</Badge>
                      </TableCell>
                      <TableCell>
                        {ws.date_acquired
                          ? format(new Date(ws.date_acquired), "MMM d, yyyy")
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="certificates" className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead>Certificate</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWorkers.flatMap((worker: any) =>
                  getWorkerCertificates(worker.id).map((cert: any) => (
                    <TableRow key={cert.id}>
                      <TableCell>
                        {worker.first_name} {worker.last_name}
                      </TableCell>
                      <TableCell>{cert.certificate_name}</TableCell>
                      <TableCell>{cert.issuing_organization}</TableCell>
                      <TableCell>
                        {cert.issue_date
                          ? format(new Date(cert.issue_date), "MMM d, yyyy")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {cert.expiry_date
                          ? format(new Date(cert.expiry_date), "MMM d, yyyy")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            cert.status === "active" ? "default" : "secondary"
                          }
                        >
                          {cert.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="licenses" className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead>License</TableHead>
                  <TableHead>Number</TableHead>
                  <TableHead>Authority</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWorkers.flatMap((worker: any) =>
                  getWorkerLicenses(worker.id).map((license: any) => (
                    <TableRow key={license.id}>
                      <TableCell>
                        {worker.first_name} {worker.last_name}
                      </TableCell>
                      <TableCell>{license.license_name}</TableCell>
                      <TableCell>{license.license_number}</TableCell>
                      <TableCell>{license.issuing_authority}</TableCell>
                      <TableCell>
                        {license.expiry_date
                          ? format(new Date(license.expiry_date), "MMM d, yyyy")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            license.status === "active" ? "default" : "secondary"
                          }
                        >
                          {license.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="training" className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead>Training</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Completion Date</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWorkers.flatMap((worker: any) =>
                  getWorkerTraining(worker.id).map((train: any) => (
                    <TableRow key={train.id}>
                      <TableCell>
                        {worker.first_name} {worker.last_name}
                      </TableCell>
                      <TableCell>{train.training_name}</TableCell>
                      <TableCell>{train.training_provider}</TableCell>
                      <TableCell>
                        {train.completion_date
                          ? format(new Date(train.completion_date), "MMM d, yyyy")
                          : "-"}
                      </TableCell>
                      <TableCell>{train.hours_completed}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            train.status === "completed" ? "default" : "secondary"
                          }
                        >
                          {train.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
