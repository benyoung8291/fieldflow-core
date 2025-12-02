import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useCompanySettings = () => {
  return useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("No tenant found");

      const { data, error } = await supabase
        .from("tenant_settings")
        .select("company_name, address_line_1, address_line_2, city, state, postcode, company_phone, company_email, abn")
        .eq("tenant_id", profile.tenant_id)
        .single();

      if (error) throw error;
      return data;
    },
  });
};
