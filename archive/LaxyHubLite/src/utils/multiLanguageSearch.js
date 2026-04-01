/**
 * Multi-language search utilities for POI recommendations
 * Enables searching across all available language data while displaying results in the current language
 */

const AVAILABLE_LANGUAGES = ['en', 'ja', 'ko', 'zh-Hant', 'zh-Hans'];

/**
 * Load POI data for all available languages
 * @returns {Promise<Object>} Object with language codes as keys and POI data as values
 */
export const loadAllLanguagePOIData = async () => {
  const allLanguageData = {};
  
  for (const lang of AVAILABLE_LANGUAGES) {
    try {
      const poiModule = await import(`../mocks/poi-recommendations/${lang}.json`);
      allLanguageData[lang] = poiModule.default;
    } catch (error) {
      console.warn(`Failed to load POI data for language ${lang}:`, error);
      allLanguageData[lang] = { data: [] };
    }
  }
  
  return allLanguageData;
};

/**
 * Create a cross-language POI index for searching
 * Maps POI slugs to all their language variants
 * @param {Object} allLanguageData - POI data for all languages
 * @returns {Map} Map of slug to language variants
 */
export const createCrossLanguageIndex = (allLanguageData) => {
  const crossLanguageIndex = new Map();
  
  // Build index of all POI variants across languages
  Object.keys(allLanguageData).forEach(language => {
    const languageData = allLanguageData[language];
    if (languageData && languageData.data) {
      languageData.data.forEach(item => {
        const slug = item.poi?.slug;
        if (!slug) return;
        
        if (!crossLanguageIndex.has(slug)) {
          crossLanguageIndex.set(slug, {});
        }
        
        crossLanguageIndex.get(slug)[language] = {
          label: item.poi.label || '',
          address: item.poi.address || '',
          highlight: item.poi.highlight || '',
          fullItem: item
        };
      });
    }
  });
  
  return crossLanguageIndex;
};

/**
 * Search across all languages for POIs matching the query
 * @param {string} query - Search query
 * @param {Object} allLanguageData - POI data for all languages
 * @param {string} displayLanguage - Language to display results in
 * @param {number} maxResults - Maximum number of results to return
 * @returns {Array} Array of matching POIs in display language
 */
export const searchAcrossLanguages = (query, allLanguageData, displayLanguage, maxResults = 5) => {
  // Minimum query length of 2 characters for multi-language support
  if (!query || !query.trim() || query.trim().length < 2) {
    return [];
  }
  
  const searchQuery = query.toLowerCase().trim();
  const crossLanguageIndex = createCrossLanguageIndex(allLanguageData);
  const matchedSlugs = new Set();
  const results = [];
  
  // Search across all language variants
  crossLanguageIndex.forEach((languageVariants, slug) => {
    let hasMatch = false;
    
    // Check if any language variant matches the search query
    Object.keys(languageVariants).forEach(language => {
      const variant = languageVariants[language];
      const label = variant.label.toLowerCase();
      const address = variant.address.toLowerCase();
      
      if (label.includes(searchQuery) || address.includes(searchQuery)) {
        hasMatch = true;
      }
    });
    
    if (hasMatch && !matchedSlugs.has(slug)) {
      matchedSlugs.add(slug);
      
      // Get the result in the display language, fallback to English if not available
      const displayVariant = languageVariants[displayLanguage] || 
                           languageVariants['en'] || 
                           languageVariants[Object.keys(languageVariants)[0]];
      
      if (displayVariant) {
        results.push(displayVariant.fullItem);
      }
    }
  });
  
  return results.slice(0, maxResults);
};

/**
 * Filter highlighted POIs using multi-language search
 * @param {string} query - Search query
 * @param {Object} allLanguageData - POI data for all languages
 * @param {string} displayLanguage - Language to display results in
 * @returns {Array} Filtered POIs with highlight weights
 */
export const filterHighlightedPOIsMultiLanguage = (query, allLanguageData, displayLanguage) => {
  if (!allLanguageData[displayLanguage]) {
    return [];
  }
  
  // Get all highlighted POIs from the display language
  const highlightedPOIs = allLanguageData[displayLanguage].data
    .filter(item => item.weightInHighlight !== -1)
    .sort((a, b) => a.weightInHighlight - b.weightInHighlight);
  
  if (!query || !query.trim()) {
    return highlightedPOIs;
  }
  
  // Perform cross-language search
  const searchResults = searchAcrossLanguages(query, allLanguageData, displayLanguage, 50);
  const searchResultSlugs = new Set(searchResults.map(item => item.poi?.slug));
  
  // Filter highlighted POIs to only include those that match the search
  return highlightedPOIs.filter(item => searchResultSlugs.has(item.poi?.slug));
};
