import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  CircularProgress
} from '@mui/material';
import { useParams } from 'react-router-dom';
import PageHeader from '../common/PageHeader';
import { useLanguage } from '../../context/LanguageContext';
import { getPOIsByType } from '../../utils/dataFetcher';
import { DEFAULT_CLIENT_ID } from '../../config/constants';
import AddressDisplay from '../common/AddressDisplay';
import { PAGE_LAYOUTS, CONTENT_PADDING } from '../../config/layout';

const POIAddressInfo = () => {
  const { language } = useLanguage();
  const { poiSlug, suiteId } = useParams();
  
  const [poi, setPOI] = useState(null);
  const [loading, setLoading] = useState(true);
  const [, setError] = useState(null);

  useEffect(() => {
    const loadPOIDetails = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Search for POI in the specific suite across different types
        const poiTypes = ['restaurant', 'attraction'];
        let foundPOI = null;
        
        for (const poiType of poiTypes) {
          try {
            const result = await getPOIsByType(DEFAULT_CLIENT_ID, suiteId, poiType, language);
            foundPOI = result.pois.find(p => p.slug === poiSlug);
            if (foundPOI) {
              foundPOI.type = poiType; // Ensure type is set
              break;
            }
          } catch (error) {
            // Continue searching other POI types
            console.warn(`Failed to search ${poiType} in ${suiteId}:`, error);
          }
        }
        
        if (!foundPOI) {
          setError(`Location with ID "${poiSlug}" not found in ${language} data.`);
          setPOI(null);
        } else {
          setPOI(foundPOI);
        }
      } catch (err) {
        console.error(`Failed to load POI details for slug ${poiSlug} in suite ${suiteId} (lang: ${language}):`, err);
        setError('Failed to load location information. Please try again later.');
        setPOI(null);
      }
      setLoading(false);
    };

    if (poiSlug && suiteId) {
      loadPOIDetails();
    }
  }, [language, poiSlug, suiteId]);

  if (loading) {
    return (
      <Container {...PAGE_LAYOUTS.AddressInfo}>
        <PageHeader title="Address" />
        <Box sx={{ ...CONTENT_PADDING.standard, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container {...PAGE_LAYOUTS.AddressInfo}>
      <PageHeader title="Address" />
      <Box sx={{ ...CONTENT_PADDING.standard }}>

        <AddressDisplay
          suiteId={suiteId}
          address={poi.address}
          nativeLanguageCode={poi.nativeLanguageCode}
          addressURL={poi.externalURL}
          addressEmbedHTML={poi.addressEmbedHTML}
          showMap={true}
          showMapButton={true}
          poiSlug={poi.slug}
        />
      </Box>
    </Container>
  );
};

export default POIAddressInfo;
