#!/usr/bin/env node

/**
 * Dynamic API Data Fetcher
 * 
 * This script dynamically discovers available suites for a client and fetches all necessary data.
 * Instead of hardcoding suite IDs, it queries the API to find available suites and uses the first one.
 * 
 * Features:
 * - Dynamic suite discovery via API
 * - Automatic configuration generation for frontend
 * - Fail-fast approach with clear error messages
 * - Multi-language support
 * - Configurable API parameters for maintainability
 * 
 * Usage:
 *   node scripts/fetch-api-data.js
 *   
 * Environment Variables (optional):
 *   CLIENT_ID - Override the default client ID (default: beppu-airbnb)
 * 
 * Customizing Hub Config Parameters:
 *   To modify what data is fetched from the hub-application-config endpoint,
 *   edit the HUB_CONFIG_PARAMS object below. The structure follows Strapi's
 *   populate and fields conventions:
 *   
 *   - fields: Array of field names to fetch
 *   - populate: Object containing nested relations to populate
 *   
 *   Example:
 *   {
 *     componentName: {
 *       fields: ['field1', 'field2'],
 *       populate: {
 *         relationName: {
 *           fields: ['relatedField']
 *         }
 *       }
 *     }
 *   }
 * 
 * Output:
 *   - Updates mock data files in src/mocks/
 *   - Generates discovered.json with dynamic configuration
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration
const API_BASE_URL = 'https://laxy-studio-strapi-c1d6d20cbc41.herokuapp.com';
const API_TOKEN = 'e67959c9c07282664a57013db7120c2d9993fb097f9bd28cde7e550e0eaff82845957f4b9d572c5a4c33813922a982c8442bb460dab88f3253b964cf59b8428f227cec012a832526060cd2511631c9c2bc7525bb4252c3c15377cd8bb6d45b88f0721bbf87752720c4cdfbe1e4551ef29108638e377e9d536127afdb571b1acb';

// Default client configuration - can be overridden via environment variable
const DEFAULT_CLIENT_ID = process.env.CLIENT_ID || 'beppu-airbnb';

// Supported languages
const LANGUAGES = ['en', 'ja', 'ko', 'zh-Hans', 'zh-Hant'];

// Base paths
const BASE_MOCK_PATH = path.join(__dirname, '..', 'src', 'mocks');

/**
 * Hub Application Config API Parameters Configuration
 * This configuration object defines what data to fetch from the hub-application-config endpoint.
 * Each section represents a different component/page of the application.
 * 
 * Structure:
 * - Key: The component/section name
 * - Value: Array of field configurations or nested populate configurations
 */
const HUB_CONFIG_PARAMS = {
  universalConfig: {
    fields: ['themeOptions'],
    populate: {
      releasedLanguages: {
        fields: ['label', 'value']
      }
    }
  },
  globalComponent: {
    fields: [
      'readMoreLabel',
      'readLessLabel',
      'hostTagLabel',
      'poweredByLabel',
      'exploreMoreAboutLabel'
    ],
    populate: {
      speechButton: {
        fields: ['label'],
        populate: {
          icon: {
            fields: ['url']
          }
        }
      },
      audioGuideButton: {
        fields: ['label']
      }
    }
  },
  header: {
    fields: ['leftRoute', 'rightRoute'],
    populate: {
      leftIcon: {
        fields: ['url']
      },
      rightIcon: {
        fields: ['url']
      }
    }
  },
  pageLanding: {
    fields: ['recommendationHeading'],
    populate: {
      naviagtion: { // Note: keeping original typo for API compatibility
        fields: ['label', 'route'],
        populate: {
          icon: {
            fields: ['url']
          }
        }
      }
    }
  },
  pageLanguage: {
    fields: ['heading'],
    populate: {
      applyButton: {
        fields: ['label']
      }
    }
  },
  pageSearch: {
    fields: [
      'searchInputPlaceholder',
      'searchResultHeading',
      'noResultsFound',
      'defaultListHeading',
      'highlightedListHeading'
    ],
    populate: {
      defaultList: {
        fields: ['label', 'value']
      }
    }
  },
  pageInfo: {
    fields: ['heading'],
    populate: {
      navigation: {
        fields: ['label', 'route'],
        populate: {
          icon: {
            fields: ['url']
          }
        }
      }
    }
  },
  pageWiFi: {
    populate: {
      scanQRButton: {
        fields: ['label']
      },
      clipboardButton: {
        fields: ['label']
      },
      showQRButton: {
        fields: ['label']
      }
    }
  },
  pagPoiDetail: { // Note: keeping original typo for API compatibility
    fields: ['recommendationHeading', 'highlightHeading'],
    populate: {
      addressIcon: {
        fields: ['url']
      },
      urlIcon: {
        fields: ['url']
      },
      dialIcon: {
        fields: ['url']
      }
    }
  }
};

/**
 * Write the discovered configuration to a JSON file for frontend use
 */
function writeDiscoveredConfig(clientId, suiteIds, currentSuite = null) {
  const configPath = path.join(__dirname, '..', 'src', 'config', 'discovered.json');
  const configData = {
    clientId: clientId,
    availableSuites: Array.isArray(suiteIds) ? suiteIds : [suiteIds],
    currentSuite: currentSuite || (Array.isArray(suiteIds) ? suiteIds[0] : suiteIds),
    discoveredAt: new Date().toISOString()
  };

  ensureDirectoryExists(path.dirname(configPath));
  fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));
  if (currentSuite) {
    console.log(`  📝 Updated configuration for suite: ${currentSuite}`);
  } else {
    console.log(`  📝 Updated configuration: ${path.relative(path.join(__dirname, '..'), configPath)}`);
  }
}

/**
 * Fetch available suites for a client
 */
async function fetchAvailableSuites(clientId) {
  const url = `${API_BASE_URL}/api/suites?filters[ownedBy][slug][$eq]=${clientId}&fields[0]=name`;
  
  console.log(`🔍 Fetching available suites for client: ${clientId}`);
  
  try {
    const data = await makeRequest(url);
    const suites = data.data || [];
    
    if (suites.length === 0) {
      throw new Error(`No suites found for client: ${clientId}`);
    }
    
    const suiteNames = suites.map(s => s.name);
    console.log(`  ✓ Found ${suites.length} suite(s): ${suiteNames.join(', ')}`);
    
    if (suites.length > 1) {
      console.log(`  ℹ️  Multiple suites available. Fetching data for all suites.`);
    }
    
    return suiteNames; // Return all suite names
  } catch (error) {
    console.error(`  ✗ Failed to fetch suites: ${error.message}`);
    throw error;
  }
}

/**
 * Makes an HTTPS GET request
 */
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    https.get(url, options, (res) => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            console.log(`  ← Error parsing JSON. Response: ${data.substring(0, 500)}...`);
            reject(new Error(`Failed to parse JSON: ${error.message}`));
          }
        } else if (res.statusCode === 404) {
          // Handle 404 as a special case - language version might not exist
          reject(new Error(`NOT_FOUND`));
        } else {
          console.log(`  ← HTTP ${res.statusCode}. Response: ${data.substring(0, 200)}...`);
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Ensure directory exists
 */
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`  📁 Created directory: ${dirPath}`);
  }
}

/**
 * Write JSON data to file with pretty formatting
 */
function writeJsonFile(filePath, data) {
  ensureDirectoryExists(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 4));
  console.log(`    ✓ Updated: ${path.relative(BASE_MOCK_PATH, filePath)}`);
}

/**
 * Fetch data for a specific endpoint and language
 */
async function fetchEndpointData(endpointKey, language, apiEndpoints) {
  const endpoint = apiEndpoints[endpointKey];
  const url = `${API_BASE_URL}${endpoint.path}?${endpoint.params}&locale=${language}`;
  
  console.log(`  📡 ${endpointKey} (${language})`);
  
  try {
    const data = await makeRequest(url);
    const outputPath = path.join(BASE_MOCK_PATH, endpoint.outputDir, `${language}.json`);
    writeJsonFile(outputPath, data);
    return true;
  } catch (error) {
    if (error.message === 'NOT_FOUND') {
      console.log(`    ⚠️ Skipped: Translation not available`);
      return 'skipped';
    } else {
      console.error(`    ✗ Failed: ${error.message}`);
      return false;
    }
  }
}

/**
 * Convert a configuration object to URL parameters format
 * This function recursively builds the populate and fields parameters for Strapi API
 */
function buildUrlParams(config, basePath = '') {
  const params = [];
  
  function processConfig(obj, path) {
    if (obj.fields && Array.isArray(obj.fields)) {
      obj.fields.forEach((field, index) => {
        params.push(`${path}[fields][${index}]=${field}`);
      });
    }
    
    if (obj.populate) {
      Object.keys(obj.populate).forEach(key => {
        const populatePath = path ? `${path}[populate][${key}]` : `populate[${key}]`;
        processConfig(obj.populate[key], populatePath);
      });
    }
  }
  
  Object.keys(config).forEach(key => {
    const configPath = basePath ? `${basePath}[${key}]` : `populate[${key}]`;
    processConfig(config[key], configPath);
  });
  
  return params.join('&');
}

/**
 * Build hub application config endpoint with dynamic parameters
 */
function buildHubConfigEndpoint() {
  const params = buildUrlParams(HUB_CONFIG_PARAMS);
  
  // Optional: Log the generated parameters for debugging
  if (process.env.DEBUG_PARAMS) {
    console.log('🔧 Generated hub config parameters:');
    console.log(params);
  }
  
  return {
    hubApplicationConfig: {
      path: '/api/hub-application-config',
      params: params,
      outputDir: 'hub-application-config'
    }
  };
}


/**
 * Main function to fetch all data
 */
async function fetchAllData() {
  console.log('🚀 Starting API data fetch...');
  console.log(`📂 Base mock path: ${BASE_MOCK_PATH}`);
  console.log(`🌐 API Base URL: ${API_BASE_URL}`);
  console.log(`🔑 Using API Token: ${API_TOKEN.substring(0, 20)}...`);
  console.log(`🗣️  Languages: ${LANGUAGES.join(', ')}`);
  
  try {
    // First, dynamically fetch all available suite IDs
    const suiteIds = await fetchAvailableSuites(DEFAULT_CLIENT_ID);
    console.log(`📋 Processing ${suiteIds.length} suite(s): ${suiteIds.join(', ')}`);
    
    // Write initial discovered configuration
    writeDiscoveredConfig(DEFAULT_CLIENT_ID, suiteIds);
    
    let totalRequests = 0;
    let successfulRequests = 0;
    let skippedRequests = 0;
    let failedRequests = 0;
    
    // Process hub application config (only once, not per suite)
    console.log(`📋 Processing hubApplicationConfig:`);
    const hubConfigEndpoint = buildHubConfigEndpoint();
    
    for (const language of LANGUAGES) {
      totalRequests++;
      const result = await fetchEndpointData('hubApplicationConfig', language, hubConfigEndpoint);
      if (result === true) {
        successfulRequests++;
      } else if (result === 'skipped') {
        skippedRequests++;
      } else {
        failedRequests++;
      }
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    // Process each suite
    for (const suiteId of suiteIds) {
      console.log(`📋 Processing suite: ${suiteId}`);
      
      // Write the discovered configuration for frontend use (update with current suite)
      writeDiscoveredConfig(DEFAULT_CLIENT_ID, suiteIds, suiteId);
      
      // Generate API endpoints with the current suite ID
      const suiteEndpoints = {
        suites: {
          path: '/api/suites',
          params: `filters[ownedBy][slug][$eq]=${DEFAULT_CLIENT_ID}&filters[name][$eq]=${suiteId}&fields[0]=name&fields[1]=label&fields[2]=headline&fields[3]=address&fields[4]=addressURL&fields[5]=addressEmbedHTML&fields[6]=checkInOut&fields[7]=amenities&fields[8]=directContact&fields[9]=houseRules&populate[slider][fields][0]=url&populate[faq][fields][0]=question&populate[faq][fields][1]=answer&populate[wifi][fields][0]=network&populate[wifi][fields][1]=password&populate[ownedBy][fields][0]=slug&populate[ownedBy][fields][1]=label&populate[ownedBy][fields][2]=greeting&populate[ownedBy][fields][3]=nativeLanguageCode&populate[ownedBy][populate][avatar][fields][0]=url&populate[ownedBy][populate][pickedPOIs][fields][0]=slug&populate[ownedBy][populate][pickedPOIs][fields][1]=label&populate[ownedBy][populate][pickedPOIs][fields][2]=address&populate[ownedBy][populate][pickedPOIs][fields][3]=addressURL&populate[ownedBy][populate][pickedPOIs][fields][4]=addressEmbedHTML&populate[ownedBy][populate][pickedPOIs][fields][5]=dial&populate[ownedBy][populate][pickedPOIs][fields][6]=highlight&populate[ownedBy][populate][pickedPOIs][fields][7]=externalURL&populate[ownedBy][populate][pickedPOIs][fields][8]=type&populate[ownedBy][populate][pickedPOIs][fields][9]=nativeLanguageCode&populate[ownedBy][populate][pickedPOIs][fields][10]=laxyURL&populate[ownedBy][populate][pickedPOIs][populate][tag_labels][fields][0]=name&populate[ownedBy][populate][pickedPOIs][populate][tag_labels][fields][1]=color&populate[ownedBy][populate][pickedPOIs][populate][coverPhoto][fields][0]=url`,
          outputDir: `suites/${DEFAULT_CLIENT_ID}/${suiteId}`
        }
      };
      
      for (const language of LANGUAGES) {
        totalRequests++;
        const result = await fetchEndpointData('suites', language, suiteEndpoints);
        if (result === true) {
          successfulRequests++;
        } else if (result === 'skipped') {
          skippedRequests++;
        } else {
          failedRequests++;
        }
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    // Process POI recommendations (only once, not per suite)
    console.log(`📋 Processing poiRecommendations:`);
    const poiEndpoints = {
      poiRecommendations: {
        path: '/api/poi-recommendations',
        params: `filters[recommended_by][slug][$eq]=${DEFAULT_CLIENT_ID}&fields[0]=recommendation&fields[1]=kmFromStay&fields[2]=weightInNearbyRestaurants&fields[3]=weightInNearbyAttractions&fields[4]=weightInHighlight&populate[poi][fields][0]=slug&populate[poi][fields][1]=label&populate[poi][fields][2]=address&populate[poi][fields][3]=highlight&populate[poi][fields][4]=externalURL&populate[poi][fields][5]=type&populate[poi][populate][tag_labels][fields][0]=name&populate[poi][populate][tag_labels][fields][1]=color&populate[poi][populate][coverPhoto][fields][0]=url&pagination[page]=1&pagination[pageSize]=10000`,
        outputDir: 'poi-recommendations'
      }
    };
    
    for (const language of LANGUAGES) {
      totalRequests++;
      const result = await fetchEndpointData('poiRecommendations', language, poiEndpoints);
      if (result === true) {
        successfulRequests++;
      } else if (result === 'skipped') {
        skippedRequests++;
      } else {
        failedRequests++;
      }
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    console.log(`\n🎉 Completed!`);
    console.log(`  ✅ Successful: ${successfulRequests}`);
    console.log(`  ⚠️  Skipped: ${skippedRequests}`);
    console.log(`  ❌ Failed: ${failedRequests}`);
    console.log(`  📊 Total: ${totalRequests}`);
    
    if (failedRequests > 0) {
      console.log(`\n⚠️  Some requests failed. Check the errors above.`);
      process.exit(1);
    } else {
      console.log(`\n✅ All available data fetched successfully!`);
    }
  } catch (error) {
    console.error(`💥 Failed to fetch suite information: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  fetchAllData().catch(error => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
}
