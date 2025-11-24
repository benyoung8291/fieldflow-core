import { useGenericPresence } from "./useGenericPresence";

export function useHelpdeskPresence(ticketId: string | null) {
  useGenericPresence({
    recordId: ticketId,
    tableName: "helpdesk_tickets",
    displayField: "subject",
    moduleName: "Help Desk",
    numberField: "ticket_number",
  });
}
