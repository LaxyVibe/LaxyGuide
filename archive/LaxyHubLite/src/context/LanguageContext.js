import React, { createContext, useContext, useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { getValidLanguageCode, extractLanguageFromPath, DEFAULT_LANGUAGE } from '../utils/languageUtils';

// Create the language context
const LanguageContext = createContext({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
});

/**
 * Language provider component to wrap the application
 * Handles language detection from URL and provides context for the rest of the app
 */
export const LanguageProvider = ({ children }) => {
  const { langCode } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Extract language from URL path
  const { langCode: extractedLangCode } = extractLanguageFromPath(location.pathname);
  const validLangCode = getValidLanguageCode(langCode || extractedLangCode);
  
  const [language, setLanguageState] = useState(validLangCode);
  
  // Update URL when language changes
  const setLanguage = (newLang) => {
    const validNewLang = getValidLanguageCode(newLang);
    
    if (validNewLang === language) return;
    
    setLanguageState(validNewLang);
    
    // Get current path without language prefix
    const { cleanedPathname } = extractLanguageFromPath(location.pathname);
    
    // Navigate to new path with updated language
    const newPath = `/${validNewLang}${cleanedPathname === '/' ? '' : cleanedPathname}`;
    navigate(newPath + location.search);
  };
  
  // Sync language state with URL on navigation
  useEffect(() => {
    const { langCode: newLangCode } = extractLanguageFromPath(location.pathname);
    const validNewLang = getValidLanguageCode(newLangCode);
    
    // Use a functional update to avoid dependency on language
    setLanguageState(prevLang => 
      validNewLang !== prevLang ? validNewLang : prevLang
    );
  }, [location.pathname]);
  
  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

// Hook to use the language context
export const useLanguage = () => {
  return useContext(LanguageContext);
};

export default LanguageContext;
