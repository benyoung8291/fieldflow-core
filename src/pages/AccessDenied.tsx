import { useNavigate, useLocation } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import DashboardLayout from "@/components/DashboardLayout";

export default function AccessDenied() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { module?: string; from?: Location };

  return (
    <DashboardLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <div className="max-w-md w-full space-y-6 text-center">
          <div className="flex justify-center">
            <div className="rounded-full bg-destructive/10 p-6">
              <ShieldAlert className="h-12 w-12 text-destructive" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Access Denied</h1>
            <p className="text-muted-foreground">
              You don't have permission to access{" "}
              {state?.module ? (
                <span className="font-medium text-foreground">
                  the {state.module.replace(/_/g, " ")} module
                </span>
              ) : (
                "this page"
              )}
              .
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              If you believe this is an error, please contact your administrator to request access.
            </p>
            
            <div className="flex gap-3 justify-center">
              <Button 
                onClick={() => navigate(-1)}
                variant="outline"
              >
                Go Back
              </Button>
              <Button 
                onClick={() => navigate("/dashboard")}
              >
                Return to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
