import { useParams, useNavigate } from "react-router-dom";
import { CustomerPortalLayout } from "@/components/layout/CustomerPortalLayout";
import { FieldReportDetail } from "@/components/customer/FieldReportDetail";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function FieldReportView() {
  const { reportId } = useParams();
  const navigate = useNavigate();

  if (!reportId) {
    return null;
  }

  return (
    <CustomerPortalLayout>
      <div className="space-y-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/customer/field-reports")}
          className="rounded-xl"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Reports
        </Button>
        <FieldReportDetail reportId={reportId} />
      </div>
    </CustomerPortalLayout>
  );
}
