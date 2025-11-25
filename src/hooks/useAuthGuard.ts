import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export const useAuthGuard = () => {
  const navigate = useNavigate();

  const { data: isActive } = useQuery({
    queryKey: ["user-active-status"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("is_active")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error checking user status:", error);
        return null;
      }

      return profile?.is_active ?? true;
    },
    refetchInterval: 30000, // Check every 30 seconds
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (isActive === false) {
      // User is deactivated, sign them out
      supabase.auth.signOut().then(() => {
        toast.error("Your account has been deactivated. Please contact your administrator.");
        navigate("/auth");
      });
    }
  }, [isActive, navigate]);

  return { isActive };
};
