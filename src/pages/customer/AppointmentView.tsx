import { useParams, useNavigate } from "react-router-dom";
import { CustomerPortalLayout } from "@/components/layout/CustomerPortalLayout";
import { AppointmentDetail } from "@/components/customer/AppointmentDetail";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function AppointmentView() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();

  if (!appointmentId) {
    return null;
  }

  return (
    <CustomerPortalLayout>
      <div className="space-y-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/customer/service-orders")}
          className="rounded-xl"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Service Orders
        </Button>
        <AppointmentDetail appointmentId={appointmentId} />
      </div>
    </CustomerPortalLayout>
  );
}
