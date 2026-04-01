// Import dynamic configuration
import { DEFAULT_CLIENT_ID, AVAILABLE_SUITES } from '../config/constants';

// Use Vite's import.meta.glob to dynamically import suite data
const getSuitesData = () => {
  try {
    const suiteModules = import.meta.glob('../mocks/suites/**/*.json', { eager: true });
    return suiteModules;
  } catch (error) {
    console.error('Error loading suite data:', error);
    return {};
  }
};

// Discover available suites based on the folder structure
const discoverAvailableSuites = () => {
  try {
    const suiteModules = getSuitesData();
    const suites = {};
    
    // Extract suite information from file paths and content
    Object.entries(suiteModules).forEach(([filePath, moduleData]) => {
      // Parse file path: '../mocks/suites/client-id/suite-id/language.json'
      const pathParts = filePath.split('/');
      const fileName = pathParts[pathParts.length - 1]; // 'en.json'
      const suiteId = pathParts[pathParts.length - 2]; // 'family-room-01'
      const clientId = pathParts[pathParts.length - 3]; // 'beppu-airbnb'
      const langCode = fileName.replace('.json', ''); // 'en'
      
      // Only process files for the current client
      if (clientId === DEFAULT_CLIENT_ID && AVAILABLE_SUITES.includes(suiteId)) {
        // Initialize suite object if it doesn't exist
        if (!suites[suiteId]) {
          suites[suiteId] = {
            id: suiteId,
            data: {}
          };
        }
        
        // Add language data
        suites[suiteId].data[langCode] = moduleData.default || moduleData;
      }
    });
    
    // Add metadata for each suite
    Object.keys(suites).forEach(suiteId => {
      const suite = suites[suiteId];
      
      // Extract name and description from English data if available, or first available language
      const defaultLangData = suite.data.en || Object.values(suite.data)[0];
      
      suite.name = defaultLangData?.data?.[0]?.label || `Suite ${suiteId}`;
      suite.description = defaultLangData?.data?.[0]?.headline || 'A comfortable suite for your stay';
      // Use the first image from slider if available, otherwise use placeholder
      suite.image = defaultLangData?.data?.[0]?.slider?.[0]?.url || 'https://source.unsplash.com/random/800x600/?hotel-room';
    });
    
    return suites;
  } catch (error) {
    console.error('Error discovering suites:', error);
    return {};
  }
};

// Map of available suites discovered dynamically at build time
const availableSuites = discoverAvailableSuites();

/**
 * Get list of all available suites
 * @returns {Array} Array of suite objects
 */
export const getAllSuites = () => {
  // Try to load real data first
  const suiteModules = getSuitesData();
  
  if (Object.keys(suiteModules).length > 0) {
    // Process real data using the discovery logic
    const suites = {};
    
    Object.entries(suiteModules).forEach(([filePath, moduleData]) => {
      const pathParts = filePath.split('/');
      const fileName = pathParts[pathParts.length - 1];
      const suiteId = pathParts[pathParts.length - 2];
      const clientId = pathParts[pathParts.length - 3];
      const langCode = fileName.replace('.json', '');
      
      if (clientId === DEFAULT_CLIENT_ID && AVAILABLE_SUITES.includes(suiteId)) {
        if (!suites[suiteId]) {
          suites[suiteId] = {
            id: suiteId,
            data: {}
          };
        }
        suites[suiteId].data[langCode] = moduleData.default || moduleData;
      }
    });
    
    // Add metadata for each suite
    Object.keys(suites).forEach(suiteId => {
      const suite = suites[suiteId];
      const defaultLangData = suite.data.en || Object.values(suite.data)[0];
      
      suite.name = defaultLangData?.data?.[0]?.label || `Suite ${suiteId}`;
      suite.description = defaultLangData?.data?.[0]?.headline || 'A comfortable suite for your stay';
      suite.image = defaultLangData?.data?.[0]?.slider?.[0]?.url || 'https://source.unsplash.com/random/800x600/?hotel-room';
    });
    
    const result = Object.values(suites);
    return result;
  }
  
  // Fallback to hardcoded test data
  const testSuites = [
    {
      id: 'family-room-01',
      name: 'Family Room 1',
      description: 'A comfortable family room for your stay',
      image: 'https://res.cloudinary.com/dui2mxeuh/image/upload/v1749993145/familyroom01_beppu_airbnb_f31309b7bc.webp'
    }
  ];
  
  return testSuites;
};

/**
 * Get suite data by ID and language
 * @param {string} suiteId - The suite ID
 * @param {string} language - The language code
 * @returns {Object|null} Suite data or null if not found
 */
export const getSuiteData = (suiteId, language) => {
  const suite = availableSuites[suiteId];
  if (!suite) return null;
  
  // Use English as fallback if requested language is not available
  const langCode = language === 'zh' ? 'zh-Hans' : language;
  const effectiveLanguage = suite.data[langCode] ? langCode : 'en';
  
  return {
    ...suite,
    details: suite.data[effectiveLanguage]
  };
};
