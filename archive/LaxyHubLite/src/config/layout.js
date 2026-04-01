/**
 * Professional PWA Layout System
 * Standardized layout configurations for consistent, professional appearance across all pages
 */

// Standard spacing system (8px base unit)
export const SPACING = {
  xs: 0.5,  // 4px
  sm: 1,    // 8px
  md: 2,    // 16px
  lg: 3,    // 24px
  xl: 4,    // 32px
  xxl: 6    // 48px
};

// Standard Material-UI maxWidth values with consistent sizing
export const LAYOUT_WIDTH = {
  // Mobile-first narrow width for mobile-optimized content
  NARROW: 'sm',  // 600px max - Perfect for mobile PWA
  
  // Medium width for general content (info pages, details)
  MEDIUM: 'md',  // 900px max - Good for tablets and desktop
  
  // Wide width for landing pages with rich content
  WIDE: 'lg',    // 1200px max - Desktop optimized
  
  // No constraint for full-width pages
  FULL: false
};

// Professional padding system for PWA consistency
export const PWA_PADDING = {
  // Standard page padding for content pages
  page: {
    xs: SPACING.md,  // 16px on mobile
    sm: SPACING.lg,  // 24px on tablet
    md: SPACING.xl   // 32px on desktop
  },
  
  // Section padding within pages
  section: {
    xs: SPACING.md,  // 16px
    sm: SPACING.lg   // 24px
  },
  
  // Navigation padding
  nav: {
    xs: SPACING.sm,  // 8px
    sm: SPACING.md   // 16px
  },
  
  // Zero padding for special cases
  none: 0
};

// Professional container configurations
export const CONTAINER_CONFIG = {
  // Mobile-first pages (search, featured content, suite pages)
  narrow: {
    maxWidth: LAYOUT_WIDTH.NARROW,
    sx: { 
      px: PWA_PADDING.none,
      py: PWA_PADDING.none,
      minHeight: '100vh'
    }
  },
  
  // Content pages (info pages, details)
  medium: {
    maxWidth: LAYOUT_WIDTH.MEDIUM,
    sx: { 
      px: PWA_PADDING.page,
      py: PWA_PADDING.xl,
      minHeight: '100vh'
    }
  },
  
  // Wide content pages (tour/place details)
  wide: {
    maxWidth: LAYOUT_WIDTH.WIDE,
    sx: { 
      px: PWA_PADDING.page,
      py: PWA_PADDING.xl
    }
  },
  
  // Suite landing with optimized mobile layout
  suiteLanding: {
    maxWidth: LAYOUT_WIDTH.NARROW,
    sx: { 
      px: PWA_PADDING.none,
      py: PWA_PADDING.none,
      pb: PWA_PADDING.xl
    }
  },
  
  // Hub landing with responsive padding
  hubLanding: {
    maxWidth: LAYOUT_WIDTH.NARROW,
    sx: { 
      px: PWA_PADDING.page,
      py: PWA_PADDING.lg,
      pt: PWA_PADDING.lg,
      minHeight: '100vh'
    }
  },
  
  // Search and navigation pages
  search: {
    maxWidth: LAYOUT_WIDTH.NARROW,
    sx: { 
      px: PWA_PADDING.none,
      py: PWA_PADDING.none,
      minHeight: '100vh'
    }
  },
  
  // Language selection page
  language: {
    maxWidth: LAYOUT_WIDTH.NARROW,
    sx: { 
      px: PWA_PADDING.none,
      py: PWA_PADDING.none,
      display: 'flex',
      flexDirection: 'column'
    }
  },
  
  // Featured content pages with consistent padding
  featured: {
    maxWidth: LAYOUT_WIDTH.NARROW,
    sx: { 
      px: PWA_PADDING.page,
      py: PWA_PADDING.md,
      pt: PWA_PADDING.lg
    }
  }
};

// Content area padding for sections within pages
export const CONTENT_PADDING = {
  // Standard content section padding
  standard: {
    px: PWA_PADDING.page,
    py: PWA_PADDING.md
  },
  
  // Navigation section padding  
  navigation: {
    px: PWA_PADDING.section,
    py: PWA_PADDING.md
  },
  
  // Card content padding
  card: {
    p: PWA_PADDING.lg
  },
  
  // Hero section padding
  hero: {
    px: PWA_PADDING.page,
    py: PWA_PADDING.xl
  }
};

// Page-specific layout configurations
export const PAGE_LAYOUTS = {
  // Main landing and navigation pages
  HubLanding: CONTAINER_CONFIG.hubLanding,
  SuiteLanding: CONTAINER_CONFIG.suiteLanding,
  SearchPage: CONTAINER_CONFIG.search,
  LanguagePage: CONTAINER_CONFIG.language,
  
  // Content detail pages
  TourLanding: CONTAINER_CONFIG.wide,
  PlaceLanding: CONTAINER_CONFIG.wide,
  POIDetail: CONTAINER_CONFIG.suiteLanding, // Changed from medium to suiteLanding
  
  
  // Information pages - all using suiteLanding width for consistency
  WifiInfo: CONTAINER_CONFIG.suiteLanding, // Changed from medium to suiteLanding
  StayInfo: CONTAINER_CONFIG.suiteLanding, // Changed from medium to suiteLanding
  AddressInfo: CONTAINER_CONFIG.suiteLanding, // Changed from medium to suiteLanding
  CheckInOutInfo: CONTAINER_CONFIG.suiteLanding, // Changed from medium to suiteLanding
  HouseRulesInfo: CONTAINER_CONFIG.suiteLanding, // Changed from medium to suiteLanding
  DirectContactInfo: CONTAINER_CONFIG.suiteLanding, // Changed from medium to suiteLanding
  AmenitiesInfo: CONTAINER_CONFIG.suiteLanding, // Changed from medium to suiteLanding
  FAQInfo: CONTAINER_CONFIG.suiteLanding // Changed from medium to suiteLanding
};
