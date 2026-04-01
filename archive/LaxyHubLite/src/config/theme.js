// Dynamic theme configuration for LaxyHub
import { createTheme } from '@mui/material/styles';

/**
 * Creates a Material-UI theme from universalConfig themeOptions
 * @param {Object} universalConfig - The universal configuration object
 * @param {string} themeName - The name of the theme to use (default: 'beppu-airbnb')
 * @returns {Object} Material-UI theme object
 */
export const createThemeFromConfig = (universalConfig, themeName = 'beppu-airbnb') => {
  // Find the theme configuration by name
  const themeConfig = universalConfig?.themeOptions?.find(theme => theme.name === themeName);
  
  if (!themeConfig) {
    throw new Error(`Theme "${themeName}" not found in universalConfig.themeOptions`);
  }

  const { colors, typography, components, custom } = themeConfig;

  // Create the Material-UI theme with the configuration
  const theme = createTheme({
    palette: {
      primary: {
        light: colors.primary[100],
        main: colors.primary[200], // Using 200 as main for better contrast
        dark: colors.primary[500],
        contrastText: '#ffffff',
      },
      secondary: {
        light: colors.secondary[100],
        main: colors.secondary[300],
        dark: colors.secondary[500],
        contrastText: '#ffffff',
      },
      background: colors.background,
      text: colors.text,
    },
    typography,
    components,
    // Add custom styles to the theme
    custom: {
    },
  });

  return theme;
};

/**
 * Get available theme names from universalConfig
 * @param {Object} universalConfig - The universal configuration object
 * @returns {string[]} Array of available theme names
 */
export const getAvailableThemes = (universalConfig) => {
  return universalConfig?.themeOptions?.map(theme => theme.name) || [];
};

/**
 * Export colors from a specific theme for use in components
 * @param {Object} universalConfig - The universal configuration object
 * @param {string} themeName - The name of the theme to get colors from
 * @returns {Object} Colors object from the theme
 */
export const getThemeColors = (universalConfig, themeName = 'beppu-airbnb') => {
  const themeConfig = universalConfig?.themeOptions?.find(theme => theme.name === themeName);
  return themeConfig?.colors || {};
};

// Default export function that creates theme from universalConfig
export default createThemeFromConfig;
