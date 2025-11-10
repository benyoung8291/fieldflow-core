import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  ClipboardList, 
  Calendar, 
  Warehouse, 
  ArrowRight, 
  CheckCircle2,
  Users,
  FileText,
  CreditCard,
  Clock,
  MapPin,
  BarChart,
  Smartphone,
  Shield,
  Zap,
  Menu,
  X
} from "lucide-react";
import { useState } from "react";

const Index = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const features = [
    {
      icon: <Calendar className="h-6 w-6" />,
      title: "Smart Scheduling",
      description: "Drag-and-drop scheduling with AI-powered worker suggestions, GPS tracking, and mobile check-in."
    },
    {
      icon: <ClipboardList className="h-6 w-6" />,
      title: "Service Orders",
      description: "Manage jobs, recurring contracts, and assignments with ease. Track progress in real-time."
    },
    {
      icon: <FileText className="h-6 w-6" />,
      title: "Quotes & Invoicing",
      description: "Create professional quotes, convert to projects, and send invoices with automated payment reminders."
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: "Team Management",
      description: "Manage worker schedules, skills, certifications, and track time logs across all jobs."
    },
    {
      icon: <Warehouse className="h-6 w-6" />,
      title: "Inventory Control",
      description: "Multi-warehouse management with barcode scanning, pick lists, and consumption tracking."
    },
    {
      icon: <CreditCard className="h-6 w-6" />,
      title: "Payment Processing",
      description: "Accept payments online, track payment status, and automate payment collection workflows."
    },
    {
      icon: <MapPin className="h-6 w-6" />,
      title: "GPS & Route Planning",
      description: "Track field workers in real-time, optimize routes, and verify job site check-ins with GPS."
    },
    {
      icon: <BarChart className="h-6 w-6" />,
      title: "Analytics & Reports",
      description: "Comprehensive dashboards and reports to track performance, revenue, and team productivity."
    },
    {
      icon: <Smartphone className="h-6 w-6" />,
      title: "Mobile App",
      description: "Full mobile experience for field workers to view jobs, update status, and log time on the go."
    }
  ];

  const upcomingFeatures = [
    "Advanced Route Optimization",
    "Customer Portal",
    "Email & SMS Automation",
    "Equipment Tracking",
    "Maintenance Schedules",
    "Advanced Reporting",
    "Third-party Integrations",
    "White-label Options"
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">SP</span>
              </div>
              <span className="text-xl font-bold">Service Pulse</span>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</a>
              <a href="#coming-soon" className="text-muted-foreground hover:text-foreground transition-colors">Roadmap</a>
              <Button variant="ghost" onClick={() => navigate("/auth")}>Office Login</Button>
              <Button onClick={() => navigate("/auth")}>Start Free Trial</Button>
            </div>

            {/* Mobile Menu Button */}
            <button 
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 space-y-4">
              <a href="#features" className="block text-muted-foreground hover:text-foreground transition-colors">Features</a>
              <a href="#coming-soon" className="block text-muted-foreground hover:text-foreground transition-colors">Roadmap</a>
              <Button variant="ghost" className="w-full" onClick={() => navigate("/auth")}>Office Login</Button>
              <Button variant="outline" className="w-full" onClick={() => navigate("/worker/auth")}>Field Worker Login</Button>
              <Button className="w-full" onClick={() => navigate("/auth")}>Start Free Trial</Button>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-24 lg:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <h1 className="text-5xl lg:text-7xl font-bold text-foreground leading-tight">
              Run Your Service Business
              <span className="block text-primary mt-2">With Confidence</span>
            </h1>
            <p className="text-xl lg:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Take back your time and speed up your success. Service Pulse helps you quote, schedule, invoice, and get paid—all in one place.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
              <Button
                size="lg"
                className="gap-2 text-lg px-8 py-6"
                onClick={() => navigate("/auth")}
              >
                Start Free Trial
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground pt-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Free 14-day trial
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                No credit card required
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24 bg-muted">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl lg:text-5xl font-bold mb-6">Everything you need to grow</h2>
              <p className="text-xl text-muted-foreground">All the tools to streamline operations and delight customers</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-12">
              <div className="text-center">
                <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                  <Clock className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-2xl font-semibold mb-3">Save Time</h3>
                <p className="text-muted-foreground text-lg leading-relaxed">Automate scheduling, invoicing, and payment collection to focus on growing your business.</p>
              </div>
              
              <div className="text-center">
                <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                  <Zap className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-2xl font-semibold mb-3">Get Paid Faster</h3>
                <p className="text-muted-foreground text-lg leading-relaxed">Send professional invoices instantly and accept payments online with automated reminders.</p>
              </div>
              
              <div className="text-center">
                <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                  <Shield className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-2xl font-semibold mb-3">Stay Organized</h3>
                <p className="text-muted-foreground text-lg leading-relaxed">Keep all customer info, job details, and team schedules in one centralized system.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-20">
              <h2 className="text-4xl lg:text-5xl font-bold mb-6">Powerful Features</h2>
              <p className="text-xl text-muted-foreground">Everything you need to manage your field service business</p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature, index) => (
                <div 
                  key={index}
                  className="bg-card p-8 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 border border-border group hover:border-primary/20"
                >
                  <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Coming Soon Section */}
      <section id="coming-soon" className="py-24 bg-muted">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl lg:text-5xl font-bold mb-6">Coming Soon</h2>
              <p className="text-xl text-muted-foreground">We're constantly improving and adding new features</p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              {upcomingFeatures.map((feature, index) => (
                <div 
                  key={index}
                  className="flex items-center gap-3 bg-background p-5 rounded-xl border border-border hover:border-primary/20 transition-colors"
                >
                  <CheckCircle2 className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <span className="text-foreground font-medium">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <h2 className="text-4xl lg:text-5xl font-bold">Ready to grow your business?</h2>
            <p className="text-xl opacity-90">Join thousands of service professionals who trust Service Pulse</p>
            <Button
              size="lg"
              variant="secondary"
              className="gap-2 text-lg px-8 py-6 bg-background text-foreground hover:bg-background/90"
              onClick={() => navigate("/auth")}
            >
              Start Your Free Trial
              <ArrowRight className="h-5 w-5" />
            </Button>
            <p className="text-sm opacity-75 pt-4">No credit card required • 14-day free trial • Cancel anytime</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto grid md:grid-cols-4 gap-12">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-bold">SP</span>
                </div>
                <span className="font-bold text-lg">Service Pulse</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Complete field service management software for growing businesses.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-6 text-lg">Product</h4>
              <ul className="space-y-3 text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#coming-soon" className="hover:text-foreground transition-colors">Roadmap</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-6 text-lg">Company</h4>
              <ul className="space-y-3 text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">About</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Support</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-6 text-lg">Legal</h4>
              <ul className="space-y-3 text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Terms of Service</a></li>
                <li>
                  <button 
                    onClick={() => navigate("/worker/auth")} 
                    className="hover:text-foreground transition-colors text-left"
                  >
                    Field Worker Login
                  </button>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="mt-16 pt-8 border-t text-center text-muted-foreground">
            <p>© 2025 Service Pulse. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
