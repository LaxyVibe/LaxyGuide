import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  TextField,
  IconButton,
  List,
  ListItem,
  ListItemText,
  InputAdornment,
  ClickAwayListener,
  MenuList,
  MenuItem,
  Chip
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ClearIcon from '@mui/icons-material/Clear';
import { useLanguage } from '../context/LanguageContext';
import { getHubConfigByLanguage } from '../mocks/hub-application-config';
import HighlightedPOIsSection from './common/HighlightedPOIsSection';
import { PAGE_LAYOUTS, CONTENT_PADDING } from '../config/layout';
import { trackSearch, trackButtonClick, trackNavigation } from '../utils/analytics';
import { loadAllLanguagePOIData, searchAcrossLanguages, filterHighlightedPOIsMultiLanguage } from '../utils/multiLanguageSearch';

// Function to highlight matching text
const highlightText = (text, searchQuery) => {
  if (!searchQuery.trim()) return text;
  
  const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  
  return parts.map((part, index) => {
    if (regex.test(part)) {
      return (
        <Box
          key={index}
          component="span"
          sx={{
            backgroundColor: 'primary.main',
            color: 'primary.contrastText',
            padding: '2px 4px',
            borderRadius: '4px',
            fontWeight: 600
          }}
        >
          {part}
        </Box>
      );
    }
    return part;
  });
};

const SearchPage = () => {
  const navigate = useNavigate();
  const params = useParams();
  const { language } = useLanguage();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchDropdownResults, setSearchDropdownResults] = useState([]);
  const [poiRecommendationsData, setPOIRecommendationsData] = useState(null);
  const [allLanguagePOIData, setAllLanguagePOIData] = useState(null);
  
  // Get hub configuration for current language
  const hubConfig = getHubConfigByLanguage(language);
  const pageSearchConfig = hubConfig?.data?.pageSearch;
  
  // Get suite ID from params
  const suiteId = params.suiteId;

  // Load POI recommendations data based on current language
  useEffect(() => {
    const loadPOIRecommendations = async () => {
      try {
        // Load current language POI data
        const poiModule = await import(`../mocks/poi-recommendations/${language}.json`);
        setPOIRecommendationsData(poiModule.default);
        
        // Load all language data for cross-language search
        const allLanguageData = await loadAllLanguagePOIData();
        setAllLanguagePOIData(allLanguageData);
      } catch (error) {
        console.error(`Failed to load POI recommendations for language ${language}:`, error);
        // Fallback to English if language-specific data is not available
        try {
          const fallbackModule = await import(`../mocks/poi-recommendations/en.json`);
          setPOIRecommendationsData(fallbackModule.default);
          
          // Still try to load all language data
          const allLanguageData = await loadAllLanguagePOIData();
          setAllLanguagePOIData(allLanguageData);
        } catch (fallbackError) {
          console.error('Failed to load fallback POI recommendations:', fallbackError);
          setPOIRecommendationsData({ data: [] });
          setAllLanguagePOIData({});
        }
      }
    };

    loadPOIRecommendations();
  }, [language]);

  // Transform POI data from poi-recommendations format to HighlightedPOIsSection format
  const transformPOIData = (poiItems) => {
    return poiItems.map(item => ({
      id: item.poi.id,
      slug: item.poi.slug,
      name: item.poi.label,
      title: item.poi.label,
      description: item.poi.highlight,
      imageUrl: item.poi.coverPhoto?.url,
      category: item.poi.type,
      // Add any additional properties that might be needed
      type: item.poi.type,
      externalURL: item.poi.externalURL
    }));
  };

  // Filter POI recommendations that have weightInHighlight !== -1 and sort by weight
  const highlightedPOIs = React.useMemo(() => {
    if (!poiRecommendationsData) return [];
    return poiRecommendationsData.data
      .filter(item => item.weightInHighlight !== -1)
      .sort((a, b) => a.weightInHighlight - b.weightInHighlight);
  }, [poiRecommendationsData]);

  const handleBack = () => {
    trackButtonClick('back_button', 'search_page');
    
    // Go back to suite page
    trackNavigation('search_page', 'suite_page', 'back_button');
    navigate(`/${language}/${suiteId}`);
  };

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    
    // Minimum query length of 2 characters for multi-language support
    if (!query || query.length < 2) {
      setShowDropdown(false);
      return;
    }
    
    // Track search
    trackSearch(query, 0);
    
    setShowDropdown(false);
    
    // Navigate to search result page
    navigate(`/${language}/${suiteId}/search/result?q=${encodeURIComponent(query)}`);
  };

  const handleSearchInputChange = (newQuery) => {
    setSearchQuery(newQuery);
    
    // Minimum query length of 2 characters for multi-language support
    if (!newQuery.trim() || newQuery.trim().length < 2) {
      setSearchDropdownResults([]);
      setShowDropdown(false);
      return;
    }

    // Use multi-language search for dropdown if all language data is available
    if (allLanguagePOIData) {
      const multiLangResults = searchAcrossLanguages(newQuery, allLanguagePOIData, language, 5);
      setSearchDropdownResults(multiLangResults);
      setShowDropdown(multiLangResults.length > 0);
    } else {
      // Fallback to current language search if multi-language data not ready
      const dropdownResults = highlightedPOIs.filter(poi => {
        const query = newQuery.toLowerCase();
        const label = poi.poi.label?.toLowerCase() || '';
        const address = poi.poi.address?.toLowerCase() || '';
        
        return label.includes(query) || address.includes(query);
      }).slice(0, 5); // Limit to 5 results for dropdown

      setSearchDropdownResults(dropdownResults);
      setShowDropdown(dropdownResults.length > 0);
    }
  };

  const handleDropdownItemClick = (poi) => {
    trackButtonClick(`poi_${poi.poi.slug}`, 'search_dropdown');
    trackNavigation('search_dropdown', 'poi_detail', 'poi_click');
    
    setSearchQuery(poi.poi.label);
    setShowDropdown(false);
    // Navigate to POI detail page
    navigate(`/${language}/${suiteId}/poi/${poi.poi.slug}`);
  };

  const handleClickAway = () => {
    setShowDropdown(false);
  };

  const handleDefaultListItemClick = (item) => {
    trackButtonClick(`default_search_${item.value}`, 'search_page');
    
    setSearchQuery(item.value);
    setShowDropdown(false);
    
    // Navigate to search result page
    navigate(`/${language}/${suiteId}/search/result?q=${encodeURIComponent(item.value)}`);
  };

  const handleClearSearch = () => {
    trackButtonClick('clear_search', 'search_page');
    setSearchQuery('');
    setSearchDropdownResults([]);
    setShowDropdown(false);
  };

  return (
    <Container {...PAGE_LAYOUTS.SearchPage}>
      {/* Search Header */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        px: 2,
        py: 1.5,
        gap: 1,
        top: 0,
        zIndex: 100,
      }}>
        {/* Back Button */}
        <IconButton
          onClick={handleBack}
          sx={{ p: 1 }}
          aria-label="back"
        >
          <ArrowBackIcon />
        </IconButton>

        {/* Search Input */}
        <Box sx={{ position: 'relative', flex: 1 }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder={pageSearchConfig?.searchInputPlaceholder }
            value={searchQuery}
            onChange={(e) => {
              handleSearchInputChange(e.target.value);
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSearch(e);
              }
            }}
            onFocus={() => {
              if (searchQuery.trim() && searchDropdownResults.length > 0) {
                setShowDropdown(true);
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
              endAdornment: searchQuery && (
                <InputAdornment position="end">
                  <IconButton
                    onClick={handleClearSearch}
                    edge="end"
                    size="small"
                    sx={{ 
                      p: 0.5,
                      '&:hover': {
                        backgroundColor: 'rgba(0, 0, 0, 0.04)',
                      }
                    }}
                    aria-label="clear search"
                  >
                    <ClearIcon fontSize="small" color="action" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{ 
              '& .MuiOutlinedInput-root': {
                borderRadius: '25px',
                backgroundColor: 'white',
                '& fieldset': {
                  borderColor: '#D7D6D6',
                  borderWidth: 1,
                },
                '&:hover fieldset': {
                  borderColor: '#D7D6D6',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#D7D6D6',
                  borderWidth: 1,
                },
              }
            }}
          />

          {/* Search Dropdown */}
          {showDropdown && searchDropdownResults.length > 0 && (
            <ClickAwayListener onClickAway={handleClickAway}>
              <Paper
                elevation={8}
                sx={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 1000,
                  mt: 0.5,
                  borderRadius: 2,
                  overflow: 'hidden'
                }}
              >
                <MenuList dense>
                  {searchDropdownResults.map((poi) => (
                    <MenuItem
                      key={poi.poi.id}
                      onClick={() => handleDropdownItemClick(poi)}
                      sx={{
                        py: 2,
                        alignItems: 'flex-start',
                        '&:hover': {
                          backgroundColor: 'rgba(0, 0, 0, 0.04)',
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                        {poi.poi.coverPhoto?.url && (
                          <Box
                            component="img"
                            src={poi.poi.coverPhoto.url}
                            alt={poi.poi.label}
                            sx={{
                              width: 40,
                              height: 40,
                              objectFit: 'cover',
                              borderRadius: 1
                            }}
                          />
                        )}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body1" sx={{ fontWeight: 500, mb: 0.5 }}>
                            {highlightText(poi.poi.label, searchQuery)}
                          </Typography>
                          
                          {/* Tag Labels */}
                          {poi.poi.tag_labels && poi.poi.tag_labels.length > 0 && (
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              {poi.poi.tag_labels.slice(0, 2).map((tag) => (
                                <Chip
                                  key={tag.id || tag.name}
                                  label={tag.name || tag}
                                  size="small"
                                  variant="outlined"
                                  sx={{
                                    fontSize: '0.6rem',
                                    height: 20,
                                    '& .MuiChip-label': {
                                      px: 0.5
                                    }
                                  }}
                                />
                              ))}
                              {poi.poi.tag_labels.length > 2 && (
                                <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5, alignSelf: 'center' }}>
                                  +{poi.poi.tag_labels.length - 2} more
                                </Typography>
                              )}
                            </Box>
                          )}
                        </Box>
                      </Box>
                    </MenuItem>
                  ))}
                </MenuList>
              </Paper>
            </ClickAwayListener>
          )}
        </Box>

      </Box>

      {/* Search Content */}
      <Box sx={{ ...CONTENT_PADDING.standard, py: 3 }}>
        {/* Default Search Keywords Section */}
        {pageSearchConfig?.defaultList && pageSearchConfig.defaultList.length > 0 && (
          <Box sx={{ mb: 4 }}>
            <Typography 
              variant="h6" 
              component="h2" 
              sx={{ 
                mb: 2, 
                fontWeight: 600,
                fontSize: '1.1rem'
              }}
            >
              {pageSearchConfig.defaultListHeading}
            </Typography>
            
            <List disablePadding>
              {pageSearchConfig.defaultList.map((item, index) => (
                <ListItem
                  key={item.id || index}
                  button
                  onClick={() => handleDefaultListItemClick(item)}
                  sx={{
                    py: 2,
                    px: 0,
                    borderBottom: index < pageSearchConfig.defaultList.length - 1 ? '2px solid rgba(0, 0, 0, 0.08)' : 'none',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.04)',
                      cursor: 'pointer'
                    },
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <ListItemText 
                    primary={item.label}
                    primaryTypographyProps={{
                      fontWeight: 500,
                      marginLeft: 1
                    }}
                  />
                  <ChevronRightIcon 
                    sx={{ 
                      color: 'rgba(0, 0, 0, 0.4)',
                      fontSize: '1.2rem',
                      marginRight: 1
                    }} 
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {/* Highlighted POIs Section */}
        {highlightedPOIs.length > 0 ? (
          <HighlightedPOIsSection
            heading={pageSearchConfig?.highlightedListHeading || "Explore More"}
            pois={transformPOIData(highlightedPOIs)}
            suiteId={suiteId}
          />
        ) : null}

        {/* Empty State */}
        {(!pageSearchConfig?.defaultList || pageSearchConfig.defaultList.length === 0) && 
         highlightedPOIs.length === 0 && (
          <Paper elevation={1} sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
            <SearchIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              Start typing to search
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Discover amazing places and experiences
            </Typography>
          </Paper>
        )}
      </Box>
    </Container>
  );
};

export default SearchPage;
