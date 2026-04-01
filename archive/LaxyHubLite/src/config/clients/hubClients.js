/**
 * Hub client configurations for different hostnames
 * These configurations are used for the HubLanding component
 */

import { getPOIsByType, loadSuiteDataForLanguage } from '../../utils/dataFetcher';
import { DEFAULT_CLIENT_ID } from '../constants';

/**
 * Fetches client information using POI data
 * @param {string} clientId - The client ID
 * @param {string} suiteId - The suite/room ID from URL
 * @param {string} language - The language code for the content
 * @returns {Promise<Object>} The client information
 */
export const fetchClientInfo = async (clientId, suiteId, language) => {
  const roomId = suiteId;

  // Get base suite data for client info
  const suiteData = await loadSuiteDataForLanguage(clientId, roomId, language);

  // Extract client info from suite data
  const suite = suiteData.data[0];
  const baseData = {
    name: suite.ownedBy.label,
    title: suite.ownedBy.label,
    subtitle: suite.ownedBy.subtitle,
    logo: suite.ownedBy.avatar.url,
    featuredTours: suite.featuredTours,
    featuredPlaces: suite.featuredPlaces,
    suites: [
      {
        id: suite.name,
        name: suite.label,
        passcode: suite.passcode,
        roomImages: suite.slider.map(img => ({
          id: img.documentId,
          src: img.url,
          alt: img.alt
        }))
      }
    ],
    carouselTitle: suite.label
  };

  // Get restaurant data using getPOIsByType
  const restaurantData = await getPOIsByType(clientId, roomId, 'restaurant', language);
  baseData.restaurantList = restaurantData.pois;
  baseData.restaurantTitle = restaurantData.title;
  baseData.restaurantSubtitle = restaurantData.subtitle;

  // Get places data using getPOIsByType
  const placesData = await getPOIsByType(clientId, roomId, 'attraction', language);
  baseData.placesList = placesData.pois;
  baseData.placesTitle = placesData.title;
  baseData.placesSubtitle = placesData.subtitle;

  return baseData;
};

// Functions moved to utils/dataFetcher.js

/**
 * Gets the client information based on the hostname and pathname
 * @param {string} hostname - The hostname of the current URL
 * @param {string} pathname - The pathname of the current URL
 * @param {string} language - The language code (required)
 * @param {string} suiteId - The suite/room ID from URL (required)
 * @returns {Promise<Object>} The client information
 */
export const getHubClientInfo = (hostname, pathname, language, suiteId) => {
  return fetchClientInfo(DEFAULT_CLIENT_ID, suiteId, language);
};

export default getHubClientInfo;