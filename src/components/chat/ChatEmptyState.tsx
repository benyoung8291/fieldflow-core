import { MessageSquare } from "lucide-react";

export function ChatEmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-background p-8 text-center">
      <div className="rounded-full bg-muted p-4">
        <MessageSquare className="h-12 w-12 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">Select a channel</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Choose a channel from the sidebar to start chatting, or create a new one.
      </p>
    </div>
  );
}
