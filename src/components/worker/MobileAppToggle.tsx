import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Smartphone, Monitor } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useWorkerRole } from '@/hooks/useWorkerRole';

export const MobileAppToggle = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { showToggle, isSupervisorOrAbove } = useWorkerRole();
  const [viewMode, setViewMode] = useState<'mobile' | 'full'>('full');

  useEffect(() => {
    // Detect if on worker routes
    if (location.pathname.startsWith('/worker')) {
      setViewMode('mobile');
    } else {
      setViewMode('full');
    }
  }, [location.pathname]);

  if (!isMobile || !showToggle) {
    return null;
  }

  const toggleView = () => {
    if (viewMode === 'mobile') {
      // Switch to full app
      navigate('/dashboard');
    } else {
      // Switch to mobile app - supervisors go to supervisor dashboard
      if (isSupervisorOrAbove) {
        navigate('/worker/supervisor-dashboard');
      } else {
        navigate('/worker/dashboard');
      }
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50">
      <Button
        onClick={toggleView}
        size="sm"
        variant="outline"
        className="bg-background shadow-lg"
      >
        {viewMode === 'mobile' ? (
          <>
            <Monitor className="h-4 w-4 mr-2" />
            Full App
          </>
        ) : (
          <>
            <Smartphone className="h-4 w-4 mr-2" />
            Mobile View
          </>
        )}
      </Button>
    </div>
  );
};
