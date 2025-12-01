import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useCustomerProfile = () => {
  return useQuery({
    queryKey: ["customer-profile-complete"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("Not authenticated");
      }

      const { data, error } = await supabase
        .from("customer_portal_users")
        .select(`
          *,
          customers (
            id,
            name,
            email,
            phone,
            address,
            city,
            state,
            postcode
          )
        `)
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });
};
