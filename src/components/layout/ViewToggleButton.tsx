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

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      className={cn(
        "h-8 w-8 rounded-full transition-colors",
        isWorkerView 
          ? "text-primary-foreground hover:bg-primary-foreground/20" 
          : "hover:bg-muted"
      )}
      title={isWorkerView ? "Switch to Office" : "Switch to Field"}
    >
      {isWorkerView ? (
        <Building2 className="h-4 w-4" />
      ) : (
        <Briefcase className="h-4 w-4" />
      )}
    </Button>
  );
}
