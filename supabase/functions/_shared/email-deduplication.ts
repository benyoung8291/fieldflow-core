/**
 * Email Deduplication Module
 * Prevents duplicate ticket creation using multiple strategies
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface EmailIdentifiers {
  microsoftMessageId: string;
  internetMessageId?: string;
  conversationId?: string;
  inReplyTo?: string;
  references?: string[];
}

export interface ExistingTicket {
  id: string;
  tenant_id: string;
  subject: string;
}

/**
 * Checks if a message already exists in the database
 */
export async function messageExists(
  supabase: SupabaseClient,
  microsoftMessageId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("helpdesk_messages")
    .select("id")
    .eq("microsoft_message_id", microsoftMessageId)
    .maybeSingle();

  return !!data;
}

/**
 * Finds an existing ticket using multiple threading strategies
 * Priority order:
 * 1. In-Reply-To header (most reliable - standard email threading)
 * 2. References header (check all Message-IDs in the chain)
 * 3. Microsoft conversationId
 * 4. Subject match (fallback, least reliable)
 */
export async function findExistingTicket(
  supabase: SupabaseClient,
  emailAccountId: string,
  identifiers: EmailIdentifiers,
  subject: string
): Promise<ExistingTicket | null> {
  // Strategy 1: In-Reply-To header
  if (identifiers.inReplyTo) {
    console.log(`🔍 Looking for ticket by In-Reply-To: ${identifiers.inReplyTo}`);
    
    const { data } = await supabase
      .from("helpdesk_messages")
      .select("ticket_id, helpdesk_tickets!inner(id, tenant_id, subject)")
      .eq("internet_message_id", identifiers.inReplyTo)
      .eq("helpdesk_tickets.email_account_id", emailAccountId)
      .limit(1)
      .maybeSingle();

    if (data) {
      console.log(`✅ Found ticket by In-Reply-To: ${data.ticket_id}`);
      return {
        id: data.ticket_id,
        tenant_id: (data as any).helpdesk_tickets.tenant_id,
        subject: (data as any).helpdesk_tickets.subject,
      };
    }
  }

  // Strategy 2: References header
  if (identifiers.references && identifiers.references.length > 0) {
    console.log(`🔍 Checking References chain (${identifiers.references.length} IDs)`);
    
    const { data } = await supabase
      .from("helpdesk_messages")
      .select("ticket_id, helpdesk_tickets!inner(id, tenant_id, subject)")
      .in("internet_message_id", identifiers.references)
      .eq("helpdesk_tickets.email_account_id", emailAccountId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      console.log(`✅ Found ticket by References: ${data.ticket_id}`);
      return {
        id: data.ticket_id,
        tenant_id: (data as any).helpdesk_tickets.tenant_id,
        subject: (data as any).helpdesk_tickets.subject,
      };
    }
  }

  // Strategy 3: Microsoft conversationId
  if (identifiers.conversationId) {
    console.log(`🔍 Looking for ticket by conversationId: ${identifiers.conversationId}`);
    
    const { data } = await supabase
      .from("helpdesk_tickets")
      .select("id, tenant_id, subject")
      .eq("microsoft_conversation_id", identifiers.conversationId)
      .eq("email_account_id", emailAccountId)
      .maybeSingle();

    if (data) {
      console.log(`✅ Found ticket by conversationId: ${data.id}`);
      return data;
    }
  }

  // Strategy 4: Subject match (fallback - least reliable)
  const isReply = subject.match(/^(RE:|Re:)\s*/i);
  if (isReply) {
    const cleanSubject = subject.replace(/^(RE:|Re:)\s*/i, "").trim();
    console.log(`⚠️ Fallback to subject matching: ${cleanSubject}`);

    // First try non-archived tickets
    const { data: activeTicket } = await supabase
      .from("helpdesk_tickets")
      .select("id, tenant_id, subject")
      .eq("email_account_id", emailAccountId)
      .eq("is_archived", false)
      .ilike("subject", cleanSubject)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeTicket) {
      console.log(`✅ Found active ticket by subject: ${activeTicket.id}`);
      return activeTicket;
    }

    // Fallback to archived tickets
    const { data: archivedTicket } = await supabase
      .from("helpdesk_tickets")
      .select("id, tenant_id, subject")
      .eq("email_account_id", emailAccountId)
      .eq("is_archived", true)
      .ilike("subject", cleanSubject)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (archivedTicket) {
      console.log(`✅ Found archived ticket by subject: ${archivedTicket.id}`);
      return archivedTicket;
    }
  }

  return null;
}

/**
 * Extract email threading headers from Microsoft Graph message
 */
export function extractThreadingHeaders(message: any): EmailIdentifiers {
  let inReplyTo: string | undefined;
  let references: string[] = [];

  if (message.internetMessageHeaders) {
    for (const header of message.internetMessageHeaders) {
      if (header.name === "In-Reply-To") {
        inReplyTo = header.value;
      } else if (header.name === "References") {
        references = header.value.split(/\s+/).filter((id: string) => id.length > 0);
      }
    }
  }

  return {
    microsoftMessageId: message.id,
    internetMessageId: message.internetMessageId,
    conversationId: message.conversationId,
    inReplyTo,
    references,
  };
}
