import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ClipboardList, Calendar, Warehouse, ArrowRight } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16 lg:py-24">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="h-16 w-16 rounded-xl bg-primary flex items-center justify-center shadow-lg">
              <span className="text-primary-foreground font-bold text-2xl">FF</span>
            </div>
          </div>
          <h1 className="text-4xl lg:text-6xl font-bold text-foreground leading-tight">
            Field Service Management
            <span className="block text-primary mt-2">Simplified</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Complete ERP solution for field service, projects, and warehouse management.
            Streamline operations, track inventory, and grow your business.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
            <Button
              size="lg"
              className="gap-2 text-lg"
              onClick={() => navigate("/auth")}
            >
              Get Started
              <ArrowRight className="h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="gap-2 text-lg"
              onClick={() => navigate("/dashboard")}
            >
              View Demo
            </Button>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mt-24 max-w-5xl mx-auto">
          <div className="bg-card p-8 rounded-xl shadow-md hover:shadow-lg transition-shadow border border-border">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <ClipboardList className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Service Orders</h3>
            <p className="text-muted-foreground">
              Manage jobs, recurring contracts, and assignments with ease. Track progress in real-time.
            </p>
          </div>
          <div className="bg-card p-8 rounded-xl shadow-md hover:shadow-lg transition-shadow border border-border">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Smart Scheduler</h3>
            <p className="text-muted-foreground">
              Drag-and-drop scheduling with GPS tracking, bidding system, and mobile check-in.
            </p>
          </div>
          <div className="bg-card p-8 rounded-xl shadow-md hover:shadow-lg transition-shadow border border-border">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <Warehouse className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Inventory Control</h3>
            <p className="text-muted-foreground">
              Multi-warehouse management with barcode scanning, pick lists, and consumption tracking.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
