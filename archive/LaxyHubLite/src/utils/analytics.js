// Google Analytics utility functions

// Configuration
const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_LAXY_HUB_MEASUREMENT_ID || 'GA_MEASUREMENT_ID_NOT_SET';
const isProduction = import.meta.env.MODE === 'production';
const isAnalyticsEnabled = isProduction && GA_MEASUREMENT_ID !== 'GA_MEASUREMENT_ID_NOT_SET';

// Queue for events before GA is loaded
let eventQueue = [];
let isGALoaded = false;
let isGAInitializing = false;
let initPromise = null;

// Helper function to ensure gtag is available
const ensureGtag = () => {
  if (typeof window !== 'undefined' && !window.gtag) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function() {
      window.dataLayer.push(arguments);
    };
  }
};

// Initialize Google Analytics
export const initGA = () => {
  if (!isAnalyticsEnabled) {
    console.log('GA: Analytics disabled in development or measurement ID not set');
    return Promise.resolve();
  }

  // Return existing promise if already initializing
  if (isGAInitializing && initPromise) {
    return initPromise;
  }

  // Return resolved promise if already loaded
  if (isGALoaded) {
    return Promise.resolve();
  }

  isGAInitializing = true;

  initPromise = new Promise((resolve, reject) => {
    // Initialize gtag function immediately
    ensureGtag();
    
    // Check if script is already loaded
    const existingScript = document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}"]`);
    if (existingScript) {
      // Script already exists, just configure
      window.gtag('js', new Date());
      window.gtag('config', GA_MEASUREMENT_ID, {
        page_title: document.title,
        page_location: window.location.href,
        send_page_view: false // We'll send page views manually
      });

      isGALoaded = true;
      isGAInitializing = false;
      processEventQueue();
      console.log('GA: Already loaded, configured with ID:', GA_MEASUREMENT_ID);
      resolve();
      return;
    }
    
    // Load GA script
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    
    script.onload = () => {
      // Configure GA after script loads
      window.gtag('js', new Date());
      window.gtag('config', GA_MEASUREMENT_ID, {
        page_title: document.title,
        page_location: window.location.href,
        send_page_view: false // We'll send page views manually
      });

      isGALoaded = true;
      isGAInitializing = false;
      processEventQueue();

      console.log('GA: Initialized with ID:', GA_MEASUREMENT_ID);
      resolve();
    };
    
    script.onerror = (error) => {
      console.error('GA: Failed to load Google Analytics script:', error);
      isGAInitializing = false;
      reject(error);
    };
    
    document.head.appendChild(script);
  });

  return initPromise;
};

// Process queued events
const processEventQueue = () => {
  eventQueue.forEach(event => {
    if (event.type === 'config') {
      window.gtag('config', event.measurementId, event.parameters);
    } else if (event.type === 'event') {
      window.gtag('event', event.eventName, event.parameters);
    }
  });
  eventQueue = []; // Clear the queue
};

// Safe gtag wrapper that queues events if GA isn't loaded yet
const safeGtag = (type, measurementIdOrEventName, parameters = {}) => {
  if (!isAnalyticsEnabled) {
    return;
  }

  ensureGtag();

  if (isGALoaded && window.gtag && typeof window.gtag === 'function') {
    // GA is loaded, call directly
    try {
      if (type === 'config') {
        window.gtag('config', measurementIdOrEventName, parameters);
      } else if (type === 'event') {
        window.gtag('event', measurementIdOrEventName, parameters);
      }
    } catch (error) {
      console.error('GA: Error calling gtag:', error);
      // Fall back to queuing if direct call fails
      queueEvent(type, measurementIdOrEventName, parameters);
    }
  } else {
    // GA not loaded yet, queue the event
    queueEvent(type, measurementIdOrEventName, parameters);
  }
};

// Helper function to queue events
const queueEvent = (type, measurementIdOrEventName, parameters) => {
  eventQueue.push({
    type,
    measurementId: type === 'config' ? measurementIdOrEventName : GA_MEASUREMENT_ID,
    eventName: type === 'event' ? measurementIdOrEventName : null,
    parameters
  });
};

// Track page views
export const trackPageView = (path, title = null) => {
  if (!isAnalyticsEnabled) {
    console.log('GA: Page view tracked (dev):', path);
    return;
  }

  safeGtag('event', 'page_view', {
    page_path: path,
    page_title: title || document.title,
    page_location: window.location.href
  });

  console.log('GA: Page view tracked:', path);
};

// Track custom events
export const trackEvent = (eventName, parameters = {}) => {
  if (!isAnalyticsEnabled) {
    console.log('GA: Event tracked (dev):', eventName, parameters);
    return;
  }

  safeGtag('event', eventName, {
    event_category: parameters.category || 'engagement',
    event_label: parameters.label || '',
    value: parameters.value || 0,
    ...parameters
  });

  console.log('GA: Event tracked:', eventName, parameters);
};

// Track user interactions
export const trackButtonClick = (buttonName, location = '') => {
  trackEvent('button_click', {
    category: 'UI Interaction',
    label: buttonName,
    location: location
  });
};

export const trackNavigation = (from, to, method = 'click') => {
  trackEvent('navigation', {
    category: 'Navigation',
    label: `${from} -> ${to}`,
    method: method
  });
};

export const trackLanguageChange = (fromLang, toLang) => {
  trackEvent('language_change', {
    category: 'Localization',
    label: `${fromLang} -> ${toLang}`
  });
};

export const trackSuiteView = (suiteId, language) => {
  trackEvent('suite_view', {
    category: 'Content',
    label: suiteId,
    language: language
  });
};

export const trackPOIView = (poiId, type, language) => {
  trackEvent('poi_view', {
    category: 'Content',
    label: poiId,
    poi_type: type,
    language: language
  });
};

export const trackSearch = (query, resultsCount = 0) => {
  trackEvent('search', {
    category: 'Search',
    label: query,
    value: resultsCount
  });
};

export const trackTourView = (tourId, language) => {
  trackEvent('tour_view', {
    category: 'Content',
    label: tourId,
    language: language
  });
};

export const trackPlaceView = (placeId, language) => {
  trackEvent('place_view', {
    category: 'Content',
    label: placeId,
    language: language
  });
};

// Content interaction tracking
export const trackContentInteraction = (action, contentType, contentId) => {
  trackEvent('content_interaction', {
    category: 'Content Interaction',
    label: `${action}_${contentType}`,
    content_id: contentId,
    action: action,
    content_type: contentType
  });
};

// External link tracking
export const trackExternalLink = (url, contentType, contentId) => {
  trackEvent('external_link_click', {
    category: 'External Links',
    label: url,
    content_type: contentType,
    content_id: contentId,
    url: url
  });
};

// Share tracking
export const trackShare = (method, additionalParams = {}) => {
  trackEvent('share', {
    category: 'Social',
    label: `${method}_${additionalParams.content_type || 'unknown'}`,
    method: method,
    ...additionalParams
  });
};

// Enhanced ecommerce events (if needed for future features)
export const trackPurchase = (transactionId, value, currency = 'USD', items = []) => {
  trackEvent('purchase', {
    transaction_id: transactionId,
    value: value,
    currency: currency,
    items: items
  });
};

// User engagement metrics
export const trackEngagement = (engagementTime, scrollDepth) => {
  trackEvent('user_engagement', {
    category: 'Engagement',
    engagement_time_msec: engagementTime,
    scroll_depth: scrollDepth
  });
};

// PWA specific events
export const trackPWAInstall = () => {
  trackEvent('pwa_install', {
    category: 'PWA',
    label: 'App Installation'
  });
};

export const trackPWAShare = (method = 'native') => {
  trackEvent('share', {
    category: 'PWA',
    method: method
  });
};

// Error tracking
export const trackError = (error, errorInfo = '') => {
  trackEvent('exception', {
    category: 'Error',
    description: error.toString(),
    fatal: false,
    error_info: errorInfo
  });
};

// Default export
const analyticsModule = {
  initGA,
  trackPageView,
  trackEvent,
  trackButtonClick,
  trackNavigation,
  trackLanguageChange,
  trackSuiteView,
  trackPOIView,
  trackSearch,
  trackTourView,
  trackPlaceView,
  trackContentInteraction,
  trackExternalLink,
  trackShare,
  trackPurchase,
  trackEngagement,
  trackPWAInstall,
  trackPWAShare,
  trackError
};

export default analyticsModule;
