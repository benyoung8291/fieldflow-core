import { Building2, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { useUserAccess } from "@/hooks/useUserAccess";
import { cn } from "@/lib/utils";

export function ViewToggleButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: access } = useUserAccess();

  // Only show toggle if user has both role and worker access
  if (!access?.showToggle) {
    return null;
  }

  const isWorkerView = location.pathname.startsWith("/worker");

  const handleToggle = () => {
    if (isWorkerView) {
      navigate("/dashboard");
    } else {
      navigate("/worker/dashboard");
    }
  };

  const isOnWorkerDashboard = location.pathname === "/worker/dashboard";

  return (
    <Button
      variant={isOnWorkerDashboard ? "ghost" : "outline"}
      size="icon"
      onClick={handleToggle}
      className={cn(
        "h-7 w-7 rounded-lg mobile-tap transition-colors",
        isOnWorkerDashboard && "text-primary-foreground hover:bg-primary-foreground/15"
      )}
      title={isWorkerView ? "Switch to Office" : "Switch to Field"}
    >
      {isWorkerView ? (
        <Building2 className="h-3.5 w-3.5" />
      ) : (
        <Briefcase className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}
