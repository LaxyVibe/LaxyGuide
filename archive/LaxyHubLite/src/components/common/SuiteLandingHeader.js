import React from 'react';
import { 
  Box, 
  IconButton,
  Typography,
  useTheme
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { getHubConfigByLanguage } from '../../mocks/hub-application-config';
import { trackButtonClick, trackNavigation } from '../../utils/analytics';

/**
 * Suite Landing Header component used specifically for SuiteLanding page
 * Shows navigation icons and handles routing for suite-specific functionality
 */
const SuiteLandingHeader = ({ title, showBackButton = false, suiteId = null }) => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const theme = useTheme();
  const hubConfig = getHubConfigByLanguage(language);
  
  // Extract header configuration
  const headerConfig = hubConfig?.data?.header || {};
  const leftRoute = headerConfig?.leftRoute || '/language';
  const rightRoute = headerConfig?.rightRoute || '/search';
  const leftIcon = headerConfig?.leftIcon?.url;
  const rightIcon = headerConfig?.rightIcon?.url;

  const handleLeftIconClick = () => {
    trackButtonClick('header_left_icon', 'global_header');
    trackNavigation('global_header', 'language_page', 'header_icon');
    
    // Include suiteId in route if available
    const basePath = suiteId ? `/${language}/${suiteId}` : `/${language}`;
    navigate(`${basePath}${leftRoute}`);
  };

  const handleRightIconClick = () => {
    trackButtonClick('header_right_icon', 'global_header');
    trackNavigation('global_header', 'search_page', 'header_icon');
    
    // Include suiteId in route if available
    const basePath = suiteId ? `/${language}/${suiteId}` : `/${language}`;
    navigate(`${basePath}${rightRoute}`);
  };

  const handleBackClick = () => {
    trackButtonClick('header_back_button', 'global_header');
    trackNavigation('global_header', 'previous_page', 'back_button');
    
    // Check if we're coming from language page with a language change
    let languageChanged = false;
    try {
      languageChanged = localStorage.getItem('languageChanged') === 'true';
      if (languageChanged) {
        localStorage.removeItem('languageChanged');
      }
    } catch (e) {
      console.error('Failed to check language changed flag:', e);
    }
    
    // Check if we're on the language page
    if (window.location.pathname.includes('/language') || languageChanged) {
      // Get the current path segments
      const pathSegments = window.location.pathname.split('/');
      
      // If we're on the language page, we need to reconstruct the path
      // to go back to where we were, but with the new language
      if (pathSegments.includes('language')) {
        // Remove 'language' from the path segments
        const newPathSegments = pathSegments.filter(segment => segment !== 'language');
        
        // Make sure language is the first real segment
        if (newPathSegments.length > 1) {
          newPathSegments[1] = language;
        }
        
        // Reconstruct the path
        const newPath = newPathSegments.join('/') || `/${language}`;
        navigate(newPath);
      } else {
        // Otherwise, just navigate back with history API
        navigate(-1);
      }
    } else {
      // For non-language pages, simply go back
      navigate(-1);
    }
  };

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        px: 2,
        pt: 1,
      }}
    >
      {/* Left icon */}
      <IconButton
        onClick={showBackButton ? handleBackClick : handleLeftIconClick}
        sx={{ p: 1 }}
      >
        {showBackButton ? (
          <ArrowBackIcon 
            sx={{ 
              width: 36, 
              height: 36, 
              color: '#333333' 
            }} 
          />
        ) : (
          <Box 
            component="img" 
            src={leftIcon} 
            alt="Language" 
            sx={{ width: 36, height: 36 }} 
          />
        )}
      </IconButton>

      {/* Title */}
      {title && (
        <Typography 
          variant="h6" 
          component="h1"
          sx={{ 
            fontFamily: '"Playfair Display", serif',
            fontSize: '32px',
            fontWeight: 900, 
            color: theme.palette.primary.light, // Using BS-100 color (primary[100])
            flexGrow: 1, 
            textAlign: 'center' 
          }}
        >
          {title}
        </Typography>
      )}

      {/* Right icon */}
      <IconButton
        onClick={handleRightIconClick}
        sx={{ p: 1 }}
      >
        <Box 
          component="img" 
          src={rightIcon} 
          alt="Search" 
          sx={{ width: 36, height: 36 }} 
        />
      </IconButton>
    </Box>
  );
};

export default SuiteLandingHeader;
