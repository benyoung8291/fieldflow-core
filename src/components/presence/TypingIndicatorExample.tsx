import { usePresence } from "@/hooks/usePresence";
import { useFieldTyping } from "@/hooks/useFieldTyping";
import FieldPresenceWrapper from "./FieldPresenceWrapper";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Example component demonstrating how to use typing indicators with FieldPresenceWrapper
 * 
 * To use in your forms:
 * 1. Call usePresence with page name
 * 2. Wrap fields with FieldPresenceWrapper
 * 3. Use useFieldTyping hook to track typing events
 */
export default function TypingIndicatorExample() {
  const { onlineUsers, startTyping, stopTyping } = usePresence({
    page: "example-form",
  });

  // Hook for customer name field
  const nameTyping = useFieldTyping({
    fieldName: "customer_name",
    startTyping,
    stopTyping,
  });

  // Hook for email field
  const emailTyping = useFieldTyping({
    fieldName: "customer_email",
    startTyping,
    stopTyping,
  });

  // Hook for notes field
  const notesTyping = useFieldTyping({
    fieldName: "notes",
    startTyping,
    stopTyping,
  });

  return (
    <div className="space-y-4 p-4">
      <div className="space-y-2">
        <Label>Customer Name</Label>
        <FieldPresenceWrapper
          fieldName="customer_name"
          onlineUsers={onlineUsers}
        >
          <Input
            placeholder="Enter customer name"
            onFocus={nameTyping.onFocus}
            onChange={nameTyping.onChange}
            onBlur={nameTyping.onBlur}
          />
        </FieldPresenceWrapper>
      </div>

      <div className="space-y-2">
        <Label>Email</Label>
        <FieldPresenceWrapper
          fieldName="customer_email"
          onlineUsers={onlineUsers}
        >
          <Input
            type="email"
            placeholder="Enter email"
            onFocus={emailTyping.onFocus}
            onChange={emailTyping.onChange}
            onBlur={emailTyping.onBlur}
          />
        </FieldPresenceWrapper>
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <FieldPresenceWrapper
          fieldName="notes"
          onlineUsers={onlineUsers}
        >
          <Textarea
            placeholder="Enter notes"
            onFocus={notesTyping.onFocus}
            onChange={notesTyping.onChange}
            onBlur={notesTyping.onBlur}
          />
        </FieldPresenceWrapper>
      </div>
    </div>
  );
}
