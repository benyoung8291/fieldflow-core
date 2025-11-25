import { Building2, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { useUserAccess } from "@/hooks/useUserAccess";

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
      variant="outline"
      size="sm"
      onClick={handleToggle}
      className="gap-2 mobile-tap"
    >
      {isWorkerView ? (
        <>
          <Building2 className="h-4 w-4" />
          <span className="hidden sm:inline">Office</span>
        </>
      ) : (
        <>
          <Briefcase className="h-4 w-4" />
          <span className="hidden sm:inline">Field</span>
        </>
      )}
    </Button>
  );
}
