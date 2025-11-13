import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('VITE_SUPABASE_PUBLISHABLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization')!;
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) throw new Error('Unauthorized');

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    const tenantId = profile?.tenant_id;
    if (!tenantId) throw new Error('No tenant found');

    // Get Acumatica credentials
    const acumaticaUsername = Deno.env.get('ACUMATICA_USERNAME');
    const acumaticaPassword = Deno.env.get('ACUMATICA_PASSWORD');
    
    const { data: integration } = await supabase
      .from('accounting_integrations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('provider', 'acumatica')
      .single();

    if (!integration?.acumatica_instance_url) {
      throw new Error('Acumatica integration not configured');
    }

    const instanceUrl = integration.acumatica_instance_url;
    const companyName = integration.acumatica_company_name;

    // Login to Acumatica
    const loginResponse = await fetch(`${instanceUrl}/entity/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: acumaticaUsername, password: acumaticaPassword, company: companyName }),
    });

    if (!loginResponse.ok) throw new Error('Acumatica authentication failed');

    const cookies = loginResponse.headers.get('set-cookie');

    // Get all credit cards for tenant
    const { data: cards } = await supabase
      .from('company_credit_cards')
      .select('*, assignedUser:profiles!company_credit_cards_assigned_to_fkey(first_name, last_name)')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    // Fetch credit card transactions from Acumatica
    const txnResponse = await fetch(
      `${instanceUrl}/entity/Default/20.200.001/CashTransaction?$filter=CashAccount/AccountCD eq 'CREDITCARD'`,
      {
        headers: {
          'Cookie': cookies || '',
          'Accept': 'application/json',
        },
      }
    );

    if (!txnResponse.ok) {
      throw new Error('Failed to fetch Acumatica transactions');
    }

    const txnData = await txnResponse.json();
    const transactions = txnData.value || [];

    // Process and insert transactions
    for (const txn of transactions) {
      let assignedTo = null;
      let cardId = null;

      const description = txn.Description?.value || '';
      
      // Try to match card number in description
      for (const card of cards || []) {
        if (card.full_card_number && description.includes(card.full_card_number)) {
          cardId = card.id;
          assignedTo = card.assigned_to;
          break;
        }
        if (card.card_provider === 'amex' && description.includes(card.last_four_digits)) {
          cardId = card.id;
          assignedTo = card.assigned_to;
          break;
        }
      }

      // If not assigned by card number, try matching user name
      if (!assignedTo && cards) {
        for (const card of cards) {
          const userName = card.assignedUser ? `${card.assignedUser.first_name || ''} ${card.assignedUser.last_name || ''}`.trim() : '';
          if (userName && description.toLowerCase().includes(userName.toLowerCase())) {
            cardId = card.id;
            assignedTo = card.assigned_to;
            break;
          }
        }
      }

      await supabase.from('credit_card_transactions').upsert({
        tenant_id: tenantId,
        external_id: txn.ReferenceNbr?.value,
        card_id: cardId,
        assigned_to: assignedTo,
        transaction_date: txn.TranDate?.value?.split('T')[0],
        description: description,
        amount: Math.abs(txn.ControlAmount?.value || 0),
        merchant_name: txn.ExtRefNbr?.value,
        status: 'unreconciled',
        is_assigned: !!assignedTo,
        sync_source: 'acumatica',
        external_reference: txn.ReferenceNbr?.value,
      }, {
        onConflict: 'tenant_id,external_id,sync_source',
        ignoreDuplicates: true,
      });
    }

    // Logout from Acumatica
    await fetch(`${instanceUrl}/entity/auth/logout`, {
      method: 'POST',
      headers: { 'Cookie': cookies || '' },
    });

    return new Response(
      JSON.stringify({ success: true, synced: transactions.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
