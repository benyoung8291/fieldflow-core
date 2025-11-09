import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import QuoteTemplatesTab from "./QuoteTemplatesTab";
import MessageTemplatesTab from "./MessageTemplatesTab";
import TermsTemplatesTab from "./TermsTemplatesTab";
import TaskTemplatesTab from "./TaskTemplatesTab";
import { FileText, MessageSquare, CheckSquare, FileCheck } from "lucide-react";

export const TemplatesTab = () => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Templates</h3>
        <p className="text-sm text-muted-foreground">
          Manage reusable templates for various business processes
        </p>
      </div>

      <Tabs defaultValue="quotes" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="quotes" className="gap-2">
            <FileText className="h-4 w-4" />
            Quotes
          </TabsTrigger>
          <TabsTrigger value="messages" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Messages
          </TabsTrigger>
          <TabsTrigger value="terms" className="gap-2">
            <FileCheck className="h-4 w-4" />
            Terms
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-2">
            <CheckSquare className="h-4 w-4" />
            Tasks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="quotes">
          <QuoteTemplatesTab />
        </TabsContent>

        <TabsContent value="messages">
          <MessageTemplatesTab />
        </TabsContent>

        <TabsContent value="terms">
          <TermsTemplatesTab />
        </TabsContent>

        <TabsContent value="tasks">
          <TaskTemplatesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};
