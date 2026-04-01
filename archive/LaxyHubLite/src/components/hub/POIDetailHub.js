import React from 'react';
import { POIDetail } from '@laxy/components';
import { useLanguage } from '../../context/LanguageContext';
import { getPOIsByType } from '../../utils/dataFetcher';
import { getHubConfigByLanguage } from '../../mocks/hub-application-config';
import { getSuiteData } from '../../utils/suiteUtils';
import { PAGE_LAYOUTS, CONTENT_PADDING } from '../../config/layout';
import { trackNavigation, trackContentInteraction } from '../../utils/analytics';
import { DEFAULT_CLIENT_ID } from '../../config/constants';

// Function to dynamically load suite data for native language POI details
const loadNativeLanguagePOI = async (poiSlug, nativeLanguageCode, suiteId) => {
  if (!nativeLanguageCode || nativeLanguageCode === 'en') {
    return null; // No native language data needed
  }
  
  try {
    const nativeModule = await import(`../../mocks/suites/${DEFAULT_CLIENT_ID}/${suiteId}/${nativeLanguageCode}.json`);
    const nativeData = nativeModule.default;
    
    // Find the POI in the native language data
    const suite = nativeData.data?.[0];
    if (suite?.ownedBy?.pickedPOIs) {
      const nativePOI = suite.ownedBy.pickedPOIs.find(poi => poi.slug === poiSlug);
      return nativePOI;
    }
    
    return null;
  } catch (error) {
    console.warn(`Failed to load native language data for ${nativeLanguageCode}:`, error);
    return null;
  }
};

// Function to load POI data for LaxyHub
const loadPOIData = async (poiSlug, language, suiteId) => {
  // Search for POI in the specific suite across different types
  const poiTypes = ['restaurant', 'attraction'];
  let foundPOI = null;
  
  for (const poiType of poiTypes) {
    try {
      const result = await getPOIsByType(DEFAULT_CLIENT_ID, suiteId, poiType, language);
      foundPOI = result.pois.find(p => p.slug === poiSlug);
      if (foundPOI) {
        foundPOI.type = poiType; // Ensure type is set
        break;
      }
    } catch (error) {
      // Continue searching other POI types
      console.warn(`Failed to search ${poiType} in ${suiteId}:`, error);
    }
  }
  
  // If no POI found in suite data, try loading directly from POI recommendations as fallback
  if (!foundPOI) {
    try {
      const poiRecommendationsModule = await import(`../../mocks/poi-recommendations/${language}.json`);
      const poiRecommendations = poiRecommendationsModule.default;
      
      const recommendationItem = poiRecommendations.data.find(item => item.poi.slug === poiSlug);
      if (recommendationItem) {
        foundPOI = {
          id: recommendationItem.poi.id,
          documentId: recommendationItem.poi.documentId,
          slug: recommendationItem.poi.slug,
          label: recommendationItem.poi.label,
          address: recommendationItem.poi.address,
          highlight: recommendationItem.poi.highlight,
          externalURL: recommendationItem.poi.externalURL,
          dial: recommendationItem.poi.dial,
          laxyURL: recommendationItem.poi.laxyURL,
          type: recommendationItem.poi.type,
          nativeLanguageCode: recommendationItem.poi.nativeLanguageCode,
          tag_labels: recommendationItem.poi.tag_labels || [],
          coverPhoto: recommendationItem.poi.coverPhoto
        };
      }
    } catch (error) {
      console.warn(`Failed to load POI recommendations as fallback:`, error);
    }
  }
  
  return foundPOI;
};

// Function to load POI recommendations for LaxyHub
const loadPOIRecommendations = async (language) => {
  try {
    const poiModule = await import(`../../mocks/poi-recommendations/${language}.json`);
    return poiModule.default;
  } catch (error) {
    console.error(`Failed to load POI recommendations for language ${language}:`, error);
    // Fallback to English if language-specific data is not available
    try {
      const fallbackModule = await import(`../../mocks/poi-recommendations/en.json`);
      return fallbackModule.default;
    } catch (fallbackError) {
      console.error('Failed to load fallback POI recommendations:', fallbackError);
      return { data: [] };
    }
  }
};

const POIDetailHub = () => {
  return (
    <POIDetail
      useLanguage={useLanguage}
      loadPOIData={loadPOIData}
      loadNativeLanguagePOI={loadNativeLanguagePOI}
      loadPOIRecommendations={loadPOIRecommendations}
      getSuiteData={getSuiteData}
      getConfig={getHubConfigByLanguage}
      pageLayouts={PAGE_LAYOUTS}
      contentPadding={CONTENT_PADDING}
      trackNavigation={trackNavigation}
      trackContentInteraction={trackContentInteraction}
    />
  );
};

export default POIDetailHub;
