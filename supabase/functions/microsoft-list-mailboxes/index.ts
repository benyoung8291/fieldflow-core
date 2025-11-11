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

    // Try to fetch shared mailboxes the user has access to
    try {
      // Query for mailboxes the user has permissions to access
      const sharedMailboxesResponse = await fetch(
        "https://graph.microsoft.com/v1.0/users?$filter=userType eq 'Member' and assignedLicenses/$count eq 0&$select=mail,displayName,userPrincipalName",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (sharedMailboxesResponse.ok) {
        const sharedData = await sharedMailboxesResponse.json();
        
        // Filter for shared mailboxes (mailboxes without licenses are typically shared)
        if (sharedData.value) {
          for (const mailbox of sharedData.value) {
            if (mailbox.mail && mailbox.mail !== userEmail) {
              mailboxes.push({
                email: mailbox.mail,
                displayName: `${mailbox.displayName || mailbox.mail} (Shared)`,
                type: "shared",
              });
            }
          }
        }
      }
    } catch (error) {
      console.log("Could not fetch shared mailboxes:", error);
      // Continue with just the personal mailbox
    }

    console.log(`Found ${mailboxes.length} mailboxes for user:`, userEmail);

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