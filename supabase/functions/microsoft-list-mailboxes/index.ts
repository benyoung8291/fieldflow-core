import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { accessToken } = await req.json();

    if (!accessToken) {
      throw new Error("Access token is required");
    }

    // Get the user's profile
    const profileResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!profileResponse.ok) {
      throw new Error("Failed to fetch user profile");
    }

    const profile = await profileResponse.json();
    const userEmail = profile.mail || profile.userPrincipalName;

    const mailboxes: Array<{
      email: string;
      displayName: string;
      type: string;
    }> = [
      {
        email: userEmail,
        displayName: `${profile.displayName} (Personal)`,
        type: "personal",
      },
    ];

    console.log(`Fetching shared mailboxes for user: ${userEmail}`);

    // Try multiple approaches to fetch shared mailboxes
    try {
      // Approach 1: Get shared mailboxes from inbox rules (delegated access)
      const rulesResponse = await fetch(
        "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messageRules",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      // Approach 2: Query users with specific criteria for shared mailboxes
      // Shared mailboxes typically have no licenses assigned
      const sharedMailboxesResponse = await fetch(
        "https://graph.microsoft.com/v1.0/users?$filter=accountEnabled eq true&$select=mail,displayName,userPrincipalName,userType&$top=999",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (sharedMailboxesResponse.ok) {
        const sharedData = await sharedMailboxesResponse.json();
        console.log(`Found ${sharedData.value?.length || 0} potential mailboxes`);
        
        if (sharedData.value) {
          // Check each mailbox to see if the user has access
          for (const mailbox of sharedData.value) {
            if (mailbox.mail && mailbox.mail !== userEmail) {
              try {
                // Try to access the mailbox to verify permissions
                const testAccessResponse = await fetch(
                  `https://graph.microsoft.com/v1.0/users/${mailbox.mail}/mailFolders/inbox`,
                  {
                    headers: { Authorization: `Bearer ${accessToken}` },
                  }
                );

                if (testAccessResponse.ok) {
                  console.log(`✅ User has access to shared mailbox: ${mailbox.mail}`);
                  mailboxes.push({
                    email: mailbox.mail,
                    displayName: `${mailbox.displayName || mailbox.mail} (Shared)`,
                    type: "shared",
                  });
                }
              } catch (accessError) {
                console.log(`❌ No access to mailbox: ${mailbox.mail}`);
                // User doesn't have access to this mailbox, skip it
              }
            }
          }
        }
      }
    } catch (error) {
      console.log("Could not fetch shared mailboxes:", error);
      // Continue with just the personal mailbox
    }

    console.log(`✅ Returning ${mailboxes.length} total mailboxes`);

    return new Response(
      JSON.stringify({ mailboxes }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in microsoft-list-mailboxes:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});