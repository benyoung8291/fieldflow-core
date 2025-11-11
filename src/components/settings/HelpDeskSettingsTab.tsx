import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HelpDeskPipelinesSettings } from "./helpdesk/HelpDeskPipelinesSettings";
import { HelpDeskEmailAccountsSettings } from "./helpdesk/HelpDeskEmailAccountsSettings";

export function HelpDeskSettingsTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Help Desk Settings</h2>
        <p className="text-muted-foreground">
          Configure help desk pipelines and email account integrations
        </p>
      </div>

      <Tabs defaultValue="pipelines" className="w-full">
        <TabsList>
          <TabsTrigger value="pipelines">Pipelines</TabsTrigger>
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
