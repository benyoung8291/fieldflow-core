import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UseGenericPresenceProps {
  recordId: string | null;
  tableName: string;
  displayField: string;
  moduleName: string;
  numberField?: string;
}

export function useGenericPresence({
  recordId,
  tableName,
  displayField,
  moduleName,
  numberField,
}: UseGenericPresenceProps) {
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .single();

      return {
        id: user.id,
        name: profile
          ? `${profile.first_name} ${profile.last_name}`
          : user.email || "Unknown User",
      };
    },
  });

  const { data: record } = useQuery({
    queryKey: [`${tableName}-for-presence`, recordId],
    queryFn: async () => {
      if (!recordId) return null;
      
      const selectFields = numberField 
        ? `${displayField}, ${numberField}`
        : displayField;

      const { data, error } = await supabase
        .from(tableName as any)
        .select(selectFields)
        .eq("id", recordId)
        .single();

      if (error) throw error;
      return data as any;
    },
    enabled: !!recordId,
  });

  useEffect(() => {
    if (!currentUser) return;

    const presenceChannel = supabase.channel("dashboard-presence");

    presenceChannel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        const currentPath = window.location.pathname + window.location.search;
        let pageName = moduleName;

        if (recordId && record) {
          const identifier = numberField && record[numberField]
            ? record[numberField]
            : record[displayField]?.substring(0, 30);
          pageName = `${moduleName}: ${identifier}`;
        }

        await presenceChannel.track({
          user_id: currentUser.id,
          user_name: currentUser.name,
          current_page: pageName,
          current_path: currentPath,
          online_at: new Date().toISOString(),
        });
      }
    });

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [currentUser, recordId, record, moduleName, displayField, numberField, tableName]);
}
