/**
 * Application constants - dynamic configuration from API discovery
 */

// Import discovered configuration from API using ES modules
import discoveredConfig from './discovered.json';

let DEFAULT_CLIENT_ID;
let DEFAULT_SUITE_ID;
let AVAILABLE_SUITES;

try {
  DEFAULT_CLIENT_ID = discoveredConfig.clientId;
  DEFAULT_SUITE_ID = discoveredConfig.currentSuite || discoveredConfig.suiteId; // Support both old and new structure
  AVAILABLE_SUITES = discoveredConfig.availableSuites || [DEFAULT_SUITE_ID]; // Support both old and new structure
  
  if (!DEFAULT_CLIENT_ID || !DEFAULT_SUITE_ID) {
    throw new Error('Missing required configuration in discovered.json');
  }
} catch (error) {
  throw new Error(`Failed to load API-discovered configuration: ${error.message}. Please run 'npm run prebuild' to fetch configuration from API.`);
}

export { DEFAULT_CLIENT_ID, DEFAULT_SUITE_ID, AVAILABLE_SUITES };

// API Configuration (if needed in frontend)
export const API_CONFIG = {
  CLIENT_ID: DEFAULT_CLIENT_ID,
  SUITE_ID: DEFAULT_SUITE_ID,
  AVAILABLE_SUITES: AVAILABLE_SUITES
};
