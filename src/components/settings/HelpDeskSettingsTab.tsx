import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HelpDeskPipelinesSettings } from "./helpdesk/HelpDeskPipelinesSettings";
import { HelpDeskEmailAccountsSettings } from "./helpdesk/HelpDeskEmailAccountsSettings";
import { WorkerSeasonalAvailabilitySettings } from "./helpdesk/WorkerSeasonalAvailabilitySettings";

export function HelpDeskSettingsTab() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">Help Desk</h2>
        <p className="text-muted-foreground">
          Manage help desk pipelines, user assignments, email integrations, and ticket workflows
        </p>
      </div>

      <Tabs defaultValue="pipelines" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="pipelines">Pipelines & Users</TabsTrigger>
          <TabsTrigger value="email-accounts">Email Accounts</TabsTrigger>
          <TabsTrigger value="seasonal-availability">Worker Availability</TabsTrigger>
        </TabsList>

        <TabsContent value="pipelines" className="mt-6">
          <HelpDeskPipelinesSettings />
        </TabsContent>

        <TabsContent value="email-accounts" className="mt-6">
          <HelpDeskEmailAccountsSettings />
        </TabsContent>

        <TabsContent value="seasonal-availability" className="mt-6">
          <WorkerSeasonalAvailabilitySettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
