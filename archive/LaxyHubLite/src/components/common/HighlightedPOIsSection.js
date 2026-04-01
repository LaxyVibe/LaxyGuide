import React from 'react';
import { Box, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';

/**
 * Reusable Highlighted POIs Section component
 * Displays a section of highlighted points of interest with configurable heading
 * 
 * @param {Object} props
 * @param {string} props.heading - The section heading text (from pageSearch.highlightedListHeading)
 * @param {Array} props.pois - Array of POI objects to display
 * @param {string} props.suiteId - The suite ID for navigation
 * @returns {JSX.Element} The highlighted POIs section component
 */
const HighlightedPOIsSection = ({ 
  heading = 'Explore More', 
  pois = [], 
  suiteId
}) => {
  const { language } = useLanguage();
  const navigate = useNavigate();

  // Don't render if no POIs are provided
  if (!pois || pois.length === 0) {
    return null;
  }

  const handlePOIClick = (poi) => {
    // Navigate to POI detail page using the correct route pattern
    // Pattern: /{language}/{suiteId}/poi/{poi.slug}
    navigate(`/${language}/${suiteId}/poi/${poi.slug}`);
  };

  return (
    <Box sx={{ mb: 3, mt: 2 }}>
      <Typography 
        component="h2" 
        sx={{ 
          mb: 2,
          fontSize: '18px',
          fontWeight: 600, 
          fontFamily: 'Inter, sans-serif',
          color: 'neutral.700',
          className: 'h-8'
        }}
      >
        {heading}
      </Typography>
      
      <Box 
        sx={{ 
          display: 'flex', 
          gap: 2, 
          overflowX: 'auto',
          pb: 1,
          px: 1,
          '&::-webkit-scrollbar': {
            height: 8,
          },
          '&::-webkit-scrollbar-track': {
            background: '#f1f1f1',
            borderRadius: 4,
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#c1c1c1',
            borderRadius: 4,
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: '#a1a1a1',
          },
        }}
      >
        {pois.map((poi) => (
          <Box
            key={poi.id}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              minWidth: 200,
              maxWidth: 200,
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-2px)',
              }
            }}
            onClick={() => handlePOIClick(poi)}
          >
            {poi.imageUrl && (
              <Box 
                component="img" 
                src={poi.imageUrl} 
                alt={poi.name || poi.title} 
                sx={{ 
                  width: '100%', 
                  height: 150, 
                  objectFit: 'cover',
                  borderRadius: 2,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  mb: 1
                }} 
              />
            )}
            
            <Typography 
              variant="body1" 
              sx={{ 
                fontFamily: 'Commissioner, sans-serif',
                fontWeight: 400,
                fontSize: '16px',
                textAlign: 'center',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {poi.name}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default HighlightedPOIsSection;
