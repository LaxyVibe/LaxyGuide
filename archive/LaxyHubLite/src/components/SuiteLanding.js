import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  Grid,
  CircularProgress
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import InfoIcon from '@mui/icons-material/Info';
import WifiIcon from '@mui/icons-material/Wifi';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import AttractionsTwoToneIcon from '@mui/icons-material/AttractionsTwoTone';
import TourIcon from '@mui/icons-material/Tour';
import { useLanguage } from '../context/LanguageContext';
import { DEFAULT_CLIENT_ID } from '../config/constants';
import Carousel from 'react-material-ui-carousel';
import { fetchClientInfo } from '../config/clients/hubClients';
import SuiteLandingHeader from './common/SuiteLandingHeader';
import NavigationButton from './common/NavigationButton';
import WifiDialog from './common/WifiDialog';
import { getHubConfigByLanguage } from '../mocks/hub-application-config';
import { getSuiteData } from '../utils/suiteUtils';
import HighlightedPOIsSection from './common/HighlightedPOIsSection';
import { PAGE_LAYOUTS, CONTENT_PADDING } from '../config/layout';
import { trackButtonClick, trackNavigation } from '../utils/analytics';

/**
 * Gets translations and configuration for the SuiteLanding component using hub application config
 * @param {string} langCode - The language code
 * @param {Object} hubConfig - The hub configuration for the language
 * @returns {Object} Translations and configuration for the SuiteLanding component
 */
const getTranslations = (langCode, hubConfig) => {
  // Initialize empty translations object
  const translations = {
    // Core navigation items
    wifiLabel: '',
    wifiIcon: '',
    infoLabel: '',
    infoIcon: '',
    restaurantsLabel: '',
    restaurantsIcon: '',
    restaurantsShortLabel: '',
    attractionsLabel: '',
    attractionsIcon: '', 
    attractionsShortLabel: '',
    toursLabel: '',
    toursIcon: '',
    
    // Page content
    popularToursLabel: '',
    
    // Buttons
    submit: 'Submit', // Default as fallback for form functionality
    checkout: 'Checkout'
  };

  // If no hub config is available, return empty translations
  if (!hubConfig || !hubConfig.data) {
    return translations;
  }

  // Extract navigation items from hub config
  if (hubConfig.data.pageLanding?.naviagtion) {
    const navItems = hubConfig.data.pageLanding.naviagtion;
    const wifiNav = navItems.find(item => item.route === "/info/wifi");
    const infoNav = navItems.find(item => item.route === "/info");
    const spotsNav = navItems.find(item => item.route === "/nearby-attractions");
    const foodsNav = navItems.find(item => item.route === "/nearby-restaurants");
    const toursNav = navItems.find(item => item.route === "/tours");

    if (wifiNav) {
      translations.wifiLabel = wifiNav.label;
      translations.wifiIcon = wifiNav.icon?.url || '';
    }
    
    if (infoNav) {
      translations.infoLabel = infoNav.label;
      translations.infoIcon = infoNav.icon?.url || '';
    }
    
    if (spotsNav) {
      translations.attractionsLabel = spotsNav.label;
      translations.attractionsShortLabel = spotsNav.label;
      translations.attractionsIcon = spotsNav.icon?.url || '';
    }
    
    if (foodsNav) {
      translations.restaurantsLabel = foodsNav.label;
      translations.restaurantsShortLabel = foodsNav.label;
      translations.restaurantsIcon = foodsNav.icon?.url || '';
    }
    
    if (toursNav) {
      translations.toursLabel = toursNav.label;
      translations.toursIcon = toursNav.icon?.url || '';
    }
    
    // Set featured experiences label if available
    if (hubConfig.data.pageLanding.recommendationHeading) {
      translations.popularToursLabel = hubConfig.data.pageLanding.recommendationHeading;
    }
  }

  // Add submit button text from language settings
  if (hubConfig.data.pageLanguage?.applyButton?.label) {
    translations.submit = hubConfig.data.pageLanguage.applyButton.label;
  }
  
  return translations;
};

const SuiteLanding = ({ clientInfo: initialClientInfo }) => {
  const { language } = useLanguage();
  const { suiteId } = useParams();
  const hubConfig = getHubConfigByLanguage(language);
  const sectionLabels = getTranslations(language, hubConfig);
  const [clientInfo, setClientInfo] = useState(initialClientInfo);
  const [loading, setLoading] = useState(!initialClientInfo);
  const [error, setError] = useState(null);
  const [suiteInfo, setSuiteInfo] = useState(null);
  const [wifiDialogOpen, setWifiDialogOpen] = useState(false);
  const [poiRecommendationsData, setPOIRecommendationsData] = useState(null);
  const navigate = useNavigate();

  // Load POI recommendations data based on current language
  useEffect(() => {
    const loadPOIRecommendations = async () => {
      try {
        const poiModule = await import(`../mocks/poi-recommendations/${language}.json`);
        setPOIRecommendationsData(poiModule.default);
      } catch (error) {
        console.error(`Failed to load POI recommendations for language ${language}:`, error);
        // Fallback to English if language-specific data is not available
        try {
          const fallbackModule = await import(`../mocks/poi-recommendations/en.json`);
          setPOIRecommendationsData(fallbackModule.default);
        } catch (fallbackError) {
          console.error('Failed to load fallback POI recommendations:', fallbackError);
          setPOIRecommendationsData({ data: [] });
        }
      }
    };

    loadPOIRecommendations();
  }, [language]);

  useEffect(() => {
    const loadClientInfo = async () => {
      try {
        const data = await fetchClientInfo(DEFAULT_CLIENT_ID, suiteId, language);
        setClientInfo(data);

        // If suiteId is present, find the matching suite
        if (data.suites && suiteId) {
          const matchingSuite = data.suites.find(suite => suite.id === suiteId);
          if (matchingSuite) {
            setSuiteInfo(matchingSuite);
          }
        }

        setLoading(false);
      } catch (err) {
        console.error("Failed to load client info:", err);
        setError("Failed to load client information. Please try again later.");
        setLoading(false);
      }
    };

    if (!initialClientInfo) {
      loadClientInfo();
    } else if (initialClientInfo.suites) {
      const matchingSuite = initialClientInfo.suites.find(suite => suite.id === suiteId);
      if (matchingSuite) {
        setSuiteInfo(matchingSuite);
      }
    }
  }, [initialClientInfo, language, suiteId]);

  // Open WiFi dialog instead of navigating to a page
  const handleWifiInfoClick = () => {
    trackButtonClick('wifi_info', 'suite_landing');
    trackNavigation('suite_landing', 'wifi_dialog', 'navigation_button');
    
    setWifiDialogOpen(true);
  };

  const handleStayInfoClick = () => {
    trackButtonClick('stay_info', 'suite_landing');
    trackNavigation('suite_landing', 'stay_info', 'navigation_button');
    
    const infoNav = hubConfig?.data?.pageLanding?.naviagtion?.find(item => item.route === "/info");
    if (infoNav) {
      navigate(`/${language}/${suiteId}${infoNav.route}`, {
        state: { 
          suiteId,
          clientInfo: {
            ...clientInfo,
            sectionLabels
          }
        }
      });
    } else {
      // Fallback to legacy route
      navigate(`/${suiteId}/${language}/stay-info`);
    }
  };

  const handleRestaurantsClick = () => {
    trackButtonClick('restaurants', 'suite_landing');
    trackNavigation('suite_landing', 'restaurants', 'navigation_button');
    
    const restaurantsNav = hubConfig?.data?.pageLanding?.naviagtion?.find(item => item.route === "/nearby-restaurants");
    if (restaurantsNav) {
      navigate(`/${language}/${suiteId}${restaurantsNav.route}`, {
        state: { 
          restaurants: clientInfo.restaurantList, 
          suiteId,
          clientInfo: {
            ...clientInfo,
            sectionLabels: {
              ...sectionLabels,
              restaurantTitle: clientInfo.restaurantTitle,
              restaurantSubtitle: clientInfo.restaurantSubtitle
            }
          } 
        }
      });
    } else {
      // Fallback to legacy route
      navigate(`/${suiteId}/${language}/featured-restaurants`, {
        state: { 
          restaurants: clientInfo.restaurantList, 
          clientInfo: {
            ...clientInfo,
            sectionLabels: {
              ...sectionLabels,
              restaurantTitle: clientInfo.restaurantTitle,
              restaurantSubtitle: clientInfo.restaurantSubtitle
            }
          } 
        }
      });
    }
  };

  const handleAttractionsClick = () => {
    trackButtonClick('attractions', 'suite_landing');
    trackNavigation('suite_landing', 'attractions', 'navigation_button');
    
    const attractionsNav = hubConfig?.data?.pageLanding?.naviagtion?.find(item => item.route === "/nearby-attractions");
    if (attractionsNav) {
      navigate(`/${language}/${suiteId}${attractionsNav.route}`, {
        state: { 
          places: clientInfo.featuredPlaces, 
          suiteId,
          clientInfo: {
            ...clientInfo,
            sectionLabels
          }
        }
      });
    } else {
      // Fallback to legacy route
      navigate(`/${suiteId}/${language}/featured-places`, {
        state: { 
          places: clientInfo.featuredPlaces, 
          clientInfo: {
            ...clientInfo,
            sectionLabels
          }
        }
      });
    }
  };

  const handleToursClick = () => {
    trackButtonClick('tours', 'suite_landing');
    trackNavigation('suite_landing', 'tours', 'navigation_button');
    
    // Open hardcoded tour URL in new tab
    const tourUrl = `https://guide.laxy.travel/${language}/tour/JPN-BEPU-TUR-001`;
    window.open(tourUrl, '_blank');
  };

    if (loading) {
    return (
      <Container sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Typography color="error">{error}</Typography>
      </Container>
    );
  }
  
  // Data for display
  const roomImages = suiteInfo ? suiteInfo.roomImages : [];
  
  // Get suite slider data
  const suiteData = getSuiteData(suiteId, language);
  const sliderImages = suiteData?.details?.data?.[0]?.slider || [];
  

  return (
    <Container {...PAGE_LAYOUTS.SuiteLanding}>
      <SuiteLandingHeader title={suiteData?.details?.data?.[0]?.ownedBy?.label} suiteId={suiteId} />
      
      <Box sx={{ ...CONTENT_PADDING.standard, py: 2 }}>
        <>
          {/* Greeting Section */}
          {suiteData?.details?.data?.[0]?.ownedBy && (
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              px: 0.5,
              pb: 2.5,
            }}>
              {suiteData.details.data[0].ownedBy.avatar && (
                <Box 
                  component="img" 
                  src={suiteData.details.data[0].ownedBy.avatar.url}
                  alt={suiteData.details.data[0].ownedBy.label}
                  sx={{ 
                    width: 60, 
                    height: 60, 
                    borderRadius: '50%',
                    mr: 2,
                    objectFit: 'cover',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }} 
                />
              )}
              <Box>
                <Typography 
                  color="text.secondary"
                  sx={{ 
                    fontFamily: 'Commissioner, sans-serif',
                    fontWeight: 400,
                    fontSize: '16px'
                  }}
                >
                  {suiteData.details.data[0].ownedBy.greeting}
                </Typography>
              </Box>
            </Box>
          )}

          {(sliderImages.length > 0 || roomImages.length > 0) && (
            <Box sx={{ mb: 2, mx: 0.5 }}>
              <Carousel 
                animation="slide"
                autoPlay
                interval={5000}
                indicators={(sliderImages.length > 0 ? sliderImages.length : roomImages.length) > 1}
                navButtonsAlwaysInvisible={(sliderImages.length > 0 ? sliderImages.length : roomImages.length) <= 1}
                sx={{ borderRadius: 2, overflow: 'hidden' }}
              >
                {(sliderImages.length > 0 ? sliderImages : roomImages).map((item, index) => (
                  <Box 
                    key={item.id || item.documentId || index}
                    sx={{ 
                      height: 250, 
                      backgroundImage: `url(${item.url || item.src})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      borderRadius: 2
                    }}
                    aria-label={item.alt || `Slide ${index + 1}`}
                  />
                ))}
              </Carousel>
            </Box>
          )}
          
          {/* Headline Section */}
          {suiteData?.details?.data?.[0]?.headline && (
            <Typography 
              component="h2" 
              sx={{ 
                fontSize: '18px',
                fontWeight: 600, 
                fontFamily: 'Inter, sans-serif',
                color: 'neutral.700',
                mb: 0.5,
                position: 'relative',
                zIndex: 1,
                className: 'h-8'
              }}
            >
              {suiteData.details.data[0].headline}
            </Typography>
          )}
          
          <Box 
            sx={{ 
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              mt: 1,
              mx: { xs: 1, sm: 2 },
              gap: 2, // Minimum 8px margin between buttons
              flexWrap: 'nowrap',
              minWidth: 0, // Allow flex items to shrink below their minimum content size
              '& > *': {
                flex: '1 1 0', // Equal flex basis with ability to grow and shrink
                minWidth: 0, // Allow items to shrink below content size
              }
            }}
          >
            {sectionLabels.infoLabel && (
              <NavigationButton
                iconUrl={sectionLabels.infoIcon}
                icon={!sectionLabels.infoIcon && <InfoIcon fontSize={window.innerWidth < 600 ? "medium" : "large"} color="primary" />}
                iconAlt="Info"
                label={sectionLabels.infoLabel}
                onClick={handleStayInfoClick}
              />
            )}
            
            {sectionLabels.wifiLabel && (
              <NavigationButton
                iconUrl={sectionLabels.wifiIcon}
                icon={!sectionLabels.wifiIcon && <WifiIcon fontSize={window.innerWidth < 600 ? "medium" : "large"} color="primary" />}
                iconAlt="WiFi"
                label={sectionLabels.wifiLabel}
                onClick={handleWifiInfoClick}
              />
            )}
            
            {sectionLabels.attractionsLabel && (
              <NavigationButton
                iconUrl={sectionLabels.attractionsIcon}
                icon={!sectionLabels.attractionsIcon && <AttractionsTwoToneIcon fontSize={window.innerWidth < 600 ? "medium" : "large"} color="primary" />}
                iconAlt="Attractions"
                label={sectionLabels.attractionsShortLabel}
                onClick={handleAttractionsClick}
              />
            )}
            
            {sectionLabels.restaurantsLabel && (
              <NavigationButton
                iconUrl={sectionLabels.restaurantsIcon}
                icon={!sectionLabels.restaurantsIcon && <RestaurantIcon fontSize={window.innerWidth < 600 ? "medium" : "large"} color="primary" />}
                iconAlt="Restaurants"
                label={sectionLabels.restaurantsShortLabel}
                onClick={handleRestaurantsClick}
              />
            )}
            
            {sectionLabels.toursLabel && (
              <NavigationButton
                iconUrl={sectionLabels.toursIcon}
                icon={!sectionLabels.toursIcon && <TourIcon fontSize={window.innerWidth < 600 ? "medium" : "large"} color="primary" />}
                iconAlt="Tours"
                label={sectionLabels.toursLabel}
                onClick={handleToursClick}
              />
            )}
          </Box>
          {/* Highlighted POIs Section */}
          <HighlightedPOIsSection 
            heading={hubConfig?.data?.pageSearch?.highlightedListHeading}
            pois={
              // Use POI recommendations data with weightInHighlight !== -1
              poiRecommendationsData ? poiRecommendationsData.data
                .filter(item => item.weightInHighlight !== -1)
                .sort((a, b) => b.weightInHighlight - a.weightInHighlight)
                .slice(0, 6) // Show top 6 highlighted POIs
                .map(item => ({
                  id: item.poi.id,
                  name: item.poi.label,
                  title: item.poi.label,
                  description: item.poi.highlight,
                  imageUrl: item.poi.coverPhoto?.url,
                  type: item.poi.type,
                  category: item.poi.type === 'attraction' ? 'Attraction' : 'Experience',
                  distance: item.kmFromStay ? `${item.kmFromStay} km` : '0.5 km',
                  slug: item.poi.slug,
                  externalURL: item.poi.externalURL
                })) : []
            }
            suiteId={suiteId}
          />
        </>
      </Box>
      
      {/* WiFi Dialog */}
      <WifiDialog 
        open={wifiDialogOpen} 
        onClose={() => setWifiDialogOpen(false)} 
        suiteId={suiteId} 
      />
    </Container>
  );
};

export default SuiteLanding;
