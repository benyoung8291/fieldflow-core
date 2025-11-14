import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeCursor } from "@/hooks/useRealtimeCursor";
import { MousePointer2 } from "lucide-react";

export default function RemoteCursors() {
  const { data: currentUser } = useQuery({
    queryKey: ["current-user-cursor"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
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

  const { cursors, clicks } = useRealtimeCursor(
    currentUser?.name || "",
    currentUser?.id || ""
  );

  return (
    <>
      {/* Render cursors */}
      {cursors.map((cursor) => (
        <div
          key={cursor.user_id}
          className="fixed pointer-events-none z-[9999] transition-all duration-100 ease-out"
          style={{
            left: `${cursor.x}px`,
            top: `${cursor.y}px`,
            transform: "translate(-2px, -2px)",
          }}
        >
          <MousePointer2
            className="h-5 w-5 drop-shadow-lg"
            style={{ 
              color: cursor.color,
              fill: cursor.color,
            }}
          />
          <div
            className="absolute left-4 top-1 px-2 py-0.5 rounded text-xs font-medium text-white whitespace-nowrap shadow-lg"
            style={{ backgroundColor: cursor.color }}
          >
            {cursor.user_name}
          </div>
        </div>
      ))}
      
      {/* Render click animations */}
      {clicks.map((click) => (
        <div
          key={click.id}
          className="fixed pointer-events-none z-[9999]"
          style={{
            left: `${click.x}px`,
            top: `${click.y}px`,
          }}
        >
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full animate-ping"
            style={{
              width: "40px",
              height: "40px",
              backgroundColor: click.color,
              opacity: 0.6,
            }}
          />
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full animate-pulse"
            style={{
              width: "20px",
              height: "20px",
              backgroundColor: click.color,
              opacity: 0.8,
            }}
          />
        </div>
      ))}
    </>
  );
}
