import React from 'react';
import { 
  Box, 
  IconButton,
  Typography 
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate, useLocation } from 'react-router-dom';
import { trackButtonClick, trackNavigation } from '../../utils/analytics';

/**
 * Simple Page Header component for standard pages
 * Shows back button with appropriate icon and navigation logic
 * @param {string} title - Page title
 * @param {function} onBack - Custom back handler (optional)
 * @param {boolean} isHierarchical - Whether to use hierarchical navigation (shows up arrow)
 */
const PageHeader = ({ title, onBack, isHierarchical }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Auto-detect hierarchical navigation for info pages if not explicitly set
  const shouldUseHierarchical = isHierarchical !== undefined 
    ? isHierarchical 
    : location.pathname.includes('/info/');

  const handleBackClick = () => {
    trackButtonClick('page_header_back_button', 'page_header');
    
    if (onBack) {
      // Use custom back handler
      trackNavigation('page_header', 'custom_back', 'back_button');
      onBack();
    } else if (shouldUseHierarchical) {
      // Use hierarchical navigation (go up one level in URL)
      trackNavigation('page_header', 'hierarchical_up', 'back_button');
      
      const pathSegments = location.pathname.split('/').filter(Boolean);
      
      // Remove the last segment to go up one level
      if (pathSegments.length > 1) {
        const parentPath = '/' + pathSegments.slice(0, -1).join('/');
        navigate(parentPath);
      } else {
        // Fallback to browser history if we can't determine parent
        navigate(-1);
      }
    } else {
      // Use browser history navigation (previous page)
      trackNavigation('page_header', 'previous_page', 'back_button');
      navigate(-1);
    }
  };

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        px: 0.5,
        py: 2,
      }}
    >
      {/* Back button */}
      <IconButton
        onClick={handleBackClick}
        sx={{ p: 0, mr: 2 }}
      >
        <ArrowBackIcon 
          sx={{ 
            width: 24, 
            height: 24, 
            color: '#333333' 
          }} 
        />
      </IconButton>

      {/* Title */}
      {title && (
        <Typography 
          variant="h6" 
          component="h1"
          sx={{ 
            fontFamily: '"Commissioner", sans-serif',
            fontSize: '24px',
            fontWeight: 700, 
            color: '#333333', 
            flexGrow: 1
          }}
        >
          {title}
        </Typography>
      )}
    </Box>
  );
};

export default PageHeader;
