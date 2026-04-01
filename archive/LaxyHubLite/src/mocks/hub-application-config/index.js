/**
 * Exports hub application configuration data for all supported languages
 */

import enConfig from './en.json';
import jaConfig from './ja.json';
import koConfig from './ko.json';
import zhHantConfig from './zh-Hant.json';
import zhHansConfig from './zh-Hans.json';

// Export all language variants
export {
  enConfig,
  jaConfig,
  koConfig,
  zhHantConfig,
  zhHansConfig,
};

// Map of language codes to their respective hub configuration data
export const hubConfigByLanguage = {
  'en': enConfig,
  'ja': jaConfig,
  'ko': koConfig,
  'zh-Hant': zhHantConfig,
  'zh-Hans': zhHansConfig,
};

/**
 * Get hub application configuration data for a specific language
 * @param {string} langCode - The language code
 * @returns {Object} The hub configuration data for the specified language or English as fallback
 */
export const getHubConfigByLanguage = (langCode) => {
  return hubConfigByLanguage[langCode] || enConfig;
};

export default getHubConfigByLanguage;
