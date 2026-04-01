import React from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useLanguage } from '../../context/LanguageContext';
import { getHubConfigByLanguage } from '../../mocks/hub-application-config';
import { getSuiteData } from '../../utils/suiteUtils';
import { PAGE_LAYOUTS } from '../../config/layout';
import { trackButtonClick, trackNavigation } from '../../utils/analytics';

const StayInfo = () => {
  const navigate = useNavigate();
  const params = useParams();
  const { language } = useLanguage();
  
  // Get hub configuration for current language
  const hubConfig = getHubConfigByLanguage(language);
  const suiteId = params.suiteId;
  
  // Get suite data for background image and label
  const suiteData = getSuiteData(suiteId, language);
  const firstSlideImage = suiteData?.details?.data?.[0]?.slider?.[0]?.url;
  const suiteLabel = suiteData?.details?.data?.[0]?.label;
  
  const handleBackClick = () => {
    trackButtonClick('stay_info_back_button', 'stay_info');
    trackNavigation('stay_info', 'suite_landing', 'back_button');
    // Always navigate back to suite landing
    navigate(`/${language}/${suiteId}`);
  };

  const handleNavigationClick = (route) => {
    trackButtonClick(`info_${route.replace('/', '_')}`, 'stay_info');
    trackNavigation('stay_info', 'info_detail', 'info_navigation');
    // Navigate to the specific info page
    navigate(`/${language}/${suiteId}${route}`);
  };

  // Get the pageInfo configuration with navigation items
  const pageInfo = hubConfig?.data?.pageInfo;

  // Filter out FAQ navigation item if FAQ data is empty
  const navigationItems = pageInfo?.navigation?.filter(item => {
    if (item.route === '/info/faq') {
      const faqData = suiteData?.details?.data?.[0]?.faq;
      return faqData && faqData.length > 0;
    }
    return true;
  }) || [];

  return (
    <Box sx={{ backgroundColor: 'background.default' }}>
      {/* Header Image Section */}
      <Container {...PAGE_LAYOUTS.StayInfo} sx={{ px: 0 }}>
        <Box 
          sx={{ 
            position: 'relative',
            width: '100%',
            height: 300,
            overflow: 'hidden',
            zIndex: 1
          }}
        >
          {/* Background Image */}
          {firstSlideImage && (
            <Box
              component="img"
              src={firstSlideImage}
              alt={suiteLabel}
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                zIndex: 2
              }}
            />
          )}
          
          {/* White Gradient Overlay */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0.3) 30%, rgba(255, 255, 255, 0) 100%)',
              zIndex: 3
            }}
          />
          
          {/* Overlay Back Button and Title */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 4,
              display: 'flex',
              alignItems: 'center',
              px: 2,
              py: 1.5
            }}
          >
            <IconButton
              onClick={handleBackClick}
              sx={{ 
                p: 1,
                px: 1.5,
                backdropFilter: 'blur(8px)',
                mr: 1,
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 1)'
                }
              }}
            >
              <ArrowBackIcon 
                sx={{ 
                  width: 24, 
                  height: 24, 
                  color: '#333333' 
                }} 
              />
            </IconButton>
            <Typography 
              variant="h5" 
              component="h1" 
              sx={{ 
                fontWeight: 'bold',
                color: '#333333',
                backdropFilter: 'blur(8px)',
                py: 1,
                borderRadius: 2
              }}
            >
              {pageInfo.heading}
            </Typography>
          </Box>
        </Box>
      </Container>
      
      {/* Main Content Card */}
      <Container {...PAGE_LAYOUTS.StayInfo} sx={{ position: 'relative', mt: -8, px: 0 }}>
        <Paper 
          elevation={0} 
          sx={{ 
            borderRadius: 4, // Remove border radius for full width
            overflow: 'hidden',
            position: 'relative',
            zIndex: 10,
            backgroundColor: '#F5F5F5', // Neutral/100 background
            px: 3, // Add horizontal padding inside the card
          }}
        >
          {/* Suite label section */}
          {suiteLabel && (
            <Typography 
              variant="h5" 
              component="h2" 
              sx={{ 
                mb: 3,
                mt: 4,
                color: 'text.secondary',
              }}
            >
              {suiteLabel}
            </Typography>
          )}

          {/* Navigation items */}
          <List sx={{ p: 0 }}>
            {navigationItems.map((item, index) => (
              <ListItem
                key={item.id || index}
                button
                onClick={() => handleNavigationClick(item.route)}
                sx={{
                  borderRadius: 2,
                  mb: 1,
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.04)',
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  {item.icon?.url ? (
                    <Box
                      component="img"
                      src={item.icon.url}
                      alt={item.label}
                      sx={{ 
                        width: 24, 
                        height: 24,
                        objectFit: 'contain'
                      }}
                    />
                  ) : (
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        backgroundColor: 'primary.main',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '0.75rem',
                      }}
                    >
                      {item.label?.[0] || '?'}
                    </Box>
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    variant: 'subtitle1',
                    fontWeight: 'medium',
                  }}
                />
                <ChevronRightIcon 
                  sx={{ 
                    color: 'text.secondary',
                    fontSize: 20
                  }} 
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      </Container>
    </Box>
  );
};

export default StayInfo;