import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HelpDeskPipelinesSettings } from "./helpdesk/HelpDeskPipelinesSettings";
import { HelpDeskEmailAccountsSettings } from "./helpdesk/HelpDeskEmailAccountsSettings";

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
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="pipelines">Pipelines & Users</TabsTrigger>
          <TabsTrigger value="email-accounts">Email Accounts</TabsTrigger>
        </TabsList>

        <TabsContent value="pipelines" className="mt-6">
          <HelpDeskPipelinesSettings />
        </TabsContent>

        <TabsContent value="email-accounts" className="mt-6">
          <HelpDeskEmailAccountsSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
