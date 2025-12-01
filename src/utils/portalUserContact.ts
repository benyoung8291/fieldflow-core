import { supabase } from "@/integrations/supabase/client";

/**
 * Ensures a portal user has a linked contact record.
 * If not, creates one and links it to the portal user.
 * Returns the contact_id.
 */
export async function ensurePortalUserContact(
  userId: string,
  customerId: string,
  tenantId: string
): Promise<string | null> {
  try {
    // 1. Get portal user details
    const { data: portalUser, error: portalError } = await supabase
      .from('customer_portal_users')
      .select('id, first_name, last_name, email, phone, contact_id')
      .eq('user_id', userId)
      .eq('customer_id', customerId)
      .single();

    if (portalError || !portalUser) {
      console.error('Portal user not found:', portalError);
      return null;
    }

    // 2. If already linked to a contact, return it
    if (portalUser.contact_id) {
      return portalUser.contact_id;
    }

    // 3. Check if a contact exists with the same email
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('email', portalUser.email)
      .eq('customer_id', customerId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (existingContact) {
      // Link the portal user to existing contact
      await supabase
        .from('customer_portal_users')
        .update({ contact_id: existingContact.id })
        .eq('id', portalUser.id);
      return existingContact.id;
    }

    // 4. Create a new contact
    const { data: newContact, error: createError } = await supabase
      .from('contacts')
      .insert({
        tenant_id: tenantId,
        customer_id: customerId,
        first_name: portalUser.first_name,
        last_name: portalUser.last_name,
        email: portalUser.email,
        phone: portalUser.phone,
        contact_type: 'customer',
        status: 'active',
        source: 'customer_portal',
      })
      .select('id')
      .single();

    if (createError || !newContact) {
      console.error('Failed to create contact:', createError);
      return null;
    }

    // Link the portal user to the new contact
    await supabase
      .from('customer_portal_users')
      .update({ contact_id: newContact.id })
      .eq('id', portalUser.id);

    return newContact.id;
  } catch (error) {
    console.error('Error ensuring portal user contact:', error);
    return null;
  }
}
