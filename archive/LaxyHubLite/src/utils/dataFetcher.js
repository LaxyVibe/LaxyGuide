/**
 * Centralized data fetching using direct mock data imports
 */
// A map to store suite data by language and room
const suiteDataCache = {};

/**
 * Dynamically loads suite data for a specific language and room
 * @param {string} clientId - The client ID
 * @param {string} roomId - The room ID
 * @param {string} language - The language code
 * @returns {Promise<Object>} - The suite data for the requested language
 */
export const loadSuiteDataForLanguage = async (clientId, roomId, language) => {
  const cacheKey = `${clientId}/${roomId}/${language}`;
  
  // If we already have this data cached, return it
  if (suiteDataCache[cacheKey]) {
    return suiteDataCache[cacheKey];
  }

  try {
    // Dynamically import the language-specific file
    const module = await import(`../mocks/suites/${clientId}/${roomId}/${language}.json`);
    suiteDataCache[cacheKey] = module.default;
    return module.default;
  } catch (error) {
    console.error(`Failed to load suite data for ${clientId}/${roomId}/${language}:`, error);
    
    // Try to fallback to English if available
    const fallbackCacheKey = `${clientId}/${roomId}/en`;
    if (suiteDataCache[fallbackCacheKey]) {
      return suiteDataCache[fallbackCacheKey];
    }
    
    // Try to load English as fallback
    if (language !== 'en') {
      try {
        const fallbackModule = await import(`../mocks/suites/${clientId}/${roomId}/en.json`);
        suiteDataCache[fallbackCacheKey] = fallbackModule.default;
        return fallbackModule.default;
      } catch (fallbackError) {
        console.error(`Failed to load fallback English data for ${clientId}/${roomId}:`, fallbackError);
      }
    }
    
    return null;
  }
};

/**
 * Get POIs by type from suite configuration data, sorted by POI recommendation weights
 * @param {string} clientId - The client ID
 * @param {string} suiteId - The suite ID
 * @param {string} type - The POI type ('restaurant' or 'attraction')
 * @param {string} language - The language code
 * @returns {Promise<Object>} - The filtered POIs data
 */
export const getPOIsByType = async (clientId, suiteId, type, language = 'en') => {
  console.log(`Getting POIs by type: client ${clientId}, suite ${suiteId}, type ${type}, language ${language}`);
  
  try {
    // Load the suite data for the requested language
    const suiteData = await loadSuiteDataForLanguage(clientId, suiteId, language);
    
    if (!suiteData || !suiteData.data || suiteData.data.length === 0) {
      return {
        pois: [],
        title: type === 'restaurant' ? 'Nearby Restaurants' : 'Nearby Attractions',
        subtitle: type === 'restaurant' ? 'Discover local dining options' : 'Explore local attractions'
      };
    }
    
    // Extract POIs from suite data filtered by type
    const suite = suiteData.data[0];
    let pois = suite.ownedBy?.pickedPOIs?.filter(poi => poi.type === type).map(poi => ({
      id: poi.id,
      documentId: poi.documentId,
      slug: poi.slug,
      label: poi.label,
      address: poi.address,
      highlight: poi.highlight,
      externalURL: poi.externalURL,
      dial: poi.dial,
      laxyURL: poi.laxyURL,
      type: poi.type,
      nativeLanguageCode: poi.nativeLanguageCode,
      tag_labels: poi.tag_labels || [],
      coverPhoto: poi.coverPhoto
    })) || [];

    // Load POI recommendations to get sorting weights
    let poiRecommendations = null;
    try {
      const poiRecommendationsModule = await import(`../mocks/poi-recommendations/${language}.json`);
      poiRecommendations = poiRecommendationsModule.default;
    } catch (error) {
      console.warn(`Failed to load POI recommendations for ${language}:`, error);
    }

    // If we have POIs from suite data, sort them by recommendation weights
    if (pois.length > 0 && poiRecommendations) {
      const weightField = type === 'restaurant' ? 'weightInNearbyRestaurants' : 'weightInNearbyAttractions';
      
      // Create a map of slug to weight for quick lookup
      const weightMap = new Map();
      poiRecommendations.data.forEach(item => {
        // Add null check for item.poi
        if (item && item.poi && item.poi.slug) {
          weightMap.set(item.poi.slug, item[weightField] || 0);
        }
      });
      
      // Sort POIs by their weights (ascending order - lower weight = higher priority)
      pois.sort((a, b) => {
        const weightA = weightMap.get(a.slug) || 0;
        const weightB = weightMap.get(b.slug) || 0;
        return weightA - weightB;
      });
    }
    
    // If no POIs found in suite data, use POI recommendations as fallback
    if (pois.length === 0 && poiRecommendations) {
      const weightField = type === 'restaurant' ? 'weightInNearbyRestaurants' : 'weightInNearbyAttractions';
      
      pois = poiRecommendations.data
        .filter(item => {
          // Add null checks for item and item.poi
          if (!item || !item.poi || !item.poi.type) {
            return false;
          }
          
          // Include POIs with positive weight and matching type
          const hasWeight = item[weightField] > 0;
          const matchesType = item.poi.type === type;
          return hasWeight && matchesType;
        })
        .sort((a, b) => a[weightField] - b[weightField]) // Sort by weight (ascending)
        .map(item => ({
          id: item.poi.id,
          documentId: item.poi.documentId,
          slug: item.poi.slug,
          label: item.poi.label,
          address: item.poi.address,
          highlight: item.poi.highlight,
          externalURL: item.poi.externalURL,
          dial: item.poi.dial,
          laxyURL: item.poi.laxyURL,
          type: item.poi.type,
          nativeLanguageCode: item.poi.nativeLanguageCode,
          tag_labels: item.poi.tag_labels || [],
          coverPhoto: item.poi.coverPhoto
        }));
    }
  
    return {
      pois,
      title: type === 'restaurant' ? 'Nearby Restaurants' : 'Nearby Attractions',
      subtitle: type === 'restaurant' ? 'Discover local dining options' : 'Explore local attractions'
    };
  } catch (error) {
    console.error(`Error getting POIs by type for ${clientId}/${suiteId}:`, error);
    return {
      pois: [],
      title: type === 'restaurant' ? 'Nearby Restaurants' : 'Nearby Attractions',
      subtitle: type === 'restaurant' ? 'Discover local dining options' : 'Explore local attractions'
    };
  }
};
