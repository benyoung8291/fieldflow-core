import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { getXeroCredentials, updateXeroTokens } from '../_shared/vault-credentials.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    
    const { data: integration } = await supabase
      .from('accounting_integrations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('provider', 'xero')
      .single();

    if (!integration?.xero_tenant_id) {
      throw new Error('Xero integration not configured');
    }

    // Get credentials from vault
    const credentials = await getXeroCredentials(supabase, integration.id);

    // Check if token needs refresh
    let accessToken = credentials.access_token;
    if (integration.xero_token_expires_at) {
      const expiresAt = new Date(integration.xero_token_expires_at);
      if (expiresAt <= new Date()) {
        // Refresh token
        const tokenResponse = await fetch("https://identity.xero.com/connect/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Basic ${btoa(`${integration.xero_client_id}:${credentials.client_secret}`)}`,
          },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: credentials.refresh_token,
          }),
        });

        if (!tokenResponse.ok) {
          throw new Error('Failed to refresh Xero token');
        }

        const tokens = await tokenResponse.json();
        accessToken = tokens.access_token;

        // Update tokens
        await updateXeroTokens(supabase, integration.id, tokens.access_token, tokens.refresh_token);
        await supabase
          .from('accounting_integrations')
          .update({
            xero_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          })
          .eq('id', integration.id);
      }
    }

    // Get all credit cards for tenant
    const { data: cards } = await supabase
      .from('company_credit_cards')
      .select('*, assignedUser:profiles!company_credit_cards_assigned_to_fkey(first_name, last_name)')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    // Fetch bank transactions from Xero (credit card accounts)
    const xeroResponse = await fetch(
      `https://api.xero.com/api.xro/2.0/BankTransactions?where=Type=="SPEND"`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'xero-tenant-id': integration.xero_tenant_id,
          'Accept': 'application/json',
        },
      }
    );

    if (!xeroResponse.ok) {
      throw new Error('Failed to fetch Xero transactions');
    }

    const xeroData = await xeroResponse.json();
    const transactions = xeroData.BankTransactions || [];

    // Process and insert transactions
    for (const txn of transactions) {
      let assignedTo = null;
      let cardId = null;

      const description = txn.Reference || txn.LineItems?.[0]?.Description || '';
      
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
        external_id: txn.BankTransactionID,
        card_id: cardId,
        assigned_to: assignedTo,
        transaction_date: txn.Date.split('T')[0],
        description: description,
        amount: Math.abs(txn.Total),
        merchant_name: txn.Contact?.Name,
        status: 'unreconciled',
        is_assigned: !!assignedTo,
        sync_source: 'xero',
        external_reference: txn.BankTransactionID,
      }, {
        onConflict: 'tenant_id,external_id,sync_source',
        ignoreDuplicates: true,
      });
    }

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
