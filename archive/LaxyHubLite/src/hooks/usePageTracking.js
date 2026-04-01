// Custom hook for Google Analytics page tracking
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView, initGA } from '../utils/analytics';

export const usePageTracking = () => {
  const location = useLocation();
  const hasTrackedInitialPage = useRef(false);

  useEffect(() => {
    const trackPage = async () => {
      const path = location.pathname + location.search;
      
      try {
        // Ensure GA is initialized before tracking
        if (!hasTrackedInitialPage.current) {
          await initGA();
          hasTrackedInitialPage.current = true;
        }
        
        // Track page view
        trackPageView(path);
      } catch (error) {
        console.error('Failed to track page view:', error);
        // Still attempt to track even if initialization failed
        trackPageView(path);
      }
    };

    trackPage();
  }, [location]);
};

export default usePageTracking;
