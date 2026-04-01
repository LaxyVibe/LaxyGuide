import React, { useState } from 'react';
import { 
  Box, 
  Container, 
  Button,
  useTheme
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { setCookie } from '../utils/cookieUtils';
import { getHubConfigByLanguage } from '../mocks/hub-application-config';
import PageHeader from './common/PageHeader';
import MenuList from './common/MenuList';
import { PAGE_LAYOUTS } from '../config/layout';
import { trackLanguageChange, trackButtonClick, trackNavigation } from '../utils/analytics';

const LanguagePage = () => {
  const { language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const theme = useTheme();
  const [selectedLanguage, setSelectedLanguage] = useState(language);
  
  // Store the referrer path when component mounts
  // useEffect is not needed anymore since we're not storing the previous path
  
  // Get configuration data for current language
  const hubConfig = getHubConfigByLanguage(language);
  
  // Extract language page configuration from current language
  const pageConfig = hubConfig?.data?.pageLanguage || {};
  const heading = pageConfig?.heading || 'Language Setting';
  
  // Get apply button label from the selected language configuration (not current language)
  const selectedHubConfig = getHubConfigByLanguage(selectedLanguage);
  const selectedPageConfig = selectedHubConfig?.data?.pageLanguage || {};
  const applyButtonLabel = selectedPageConfig?.applyButton?.label || 'Apply';
  
  // Get the list of released languages from the universal config
  // Use the current language's configuration to show the language names in the current language
  const releasedLanguages = hubConfig?.data?.universalConfig?.releasedLanguages || [];
  
  const handleLanguageItemClick = (languageItem) => {
    const newLanguage = languageItem.value;
    trackButtonClick('language_selection', 'language_page');
    
    setSelectedLanguage(newLanguage);
    // Don't apply immediately - wait for Apply button
  };
  
  const handleApply = (langToApply = selectedLanguage) => {
    trackLanguageChange(language, langToApply);
    trackButtonClick('apply_language', 'language_page');
    trackNavigation('language_page', 'suite_landing_direct', 'language_apply');
    
    // Store language preference in cookie (30-day expiry)
    setCookie('preferredLanguage', langToApply, 30);
    
    // Signal to PageHeader that language has been changed
    try {
      localStorage.setItem('languageChanged', 'true');
    } catch (e) {
      console.error('Failed to set language changed flag:', e);
    }
    
    // Extract the suiteId from the current URL path
    const pathParts = window.location.pathname.split('/');
    let suiteId = null;
    
    // The URL pattern could be /:langCode/:suiteId/language
    // Find position of current language code in URL
    const langIndex = pathParts.findIndex(part => part === language);
    if (langIndex >= 0 && langIndex + 1 < pathParts.length) {
      // The part after language code should be suiteId
      suiteId = pathParts[langIndex + 1];
    }
    
    // If we found a suiteId in the URL, directly navigate to the suite landing with new language
    if (suiteId) {
      // Update language in context
      setLanguage(langToApply);
      
      // Explicitly navigate to the suite landing page with the new language
      // Construct the URL as /:newLanguage/:suiteId/
      navigate(`/${langToApply}/${suiteId}`);
    } else {
      // If no suiteId was found, just update the language and let the normal navigation happen
      setLanguage(langToApply);
    }
  };
  
  return (
    <Container {...PAGE_LAYOUTS.LanguagePage} sx={{ display: 'flex', flexDirection: 'column', pb: 0, px: 3 }}>
      <PageHeader title={heading} />
      
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box sx={{ flex: 1, overflowY: 'auto', pb: 2 }}>
          <MenuList
            items={releasedLanguages}
            onItemClick={handleLanguageItemClick}
            showHeader={false}
            showArrow={false}
            selectedValue={selectedLanguage}
            sx={{ mb: 0, px: 1 }}
            tickColor={theme.palette.primary.light} // Using primary[100] for tick sign
          />
        </Box>
        
        {/* Apply Button - Fixed at bottom */}
        <Box 
          sx={{ 
            position: 'sticky',
            bottom: 0,
            backgroundColor: 'background.default',
            pt: 2, 
            pb: 2,
            zIndex: 10
          }}
        >
          <Button
            variant="contained"
            fullWidth
            size="large"
            onClick={() => handleApply()}
            disabled={selectedLanguage === language}
            sx={{
              py: 1.5,
              borderRadius: 16,
              fontWeight: 600,
              minHeight: 48,
              backgroundColor: theme.palette.primary.light, // Using primary[100] color
              '&:hover': {
                backgroundColor: theme.palette.primary.light,
                opacity: 0.9
              },
              '&:disabled': {
                backgroundColor: theme.palette.action.disabled
              }
            }}
          >
            {applyButtonLabel}
          </Button>
        </Box>
      </Box>
    </Container>
  );
};

export default LanguagePage;
