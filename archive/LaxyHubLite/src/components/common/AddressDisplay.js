import React, { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  useTheme
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CloseIcon from '@mui/icons-material/Close';
import { useLanguage } from '../../context/LanguageContext';
import { getSuiteData } from '../../utils/suiteUtils';
import { getHubConfigByLanguage } from '../../mocks/hub-application-config';

const AddressDisplay = ({ 
  suiteId, 
  address, 
  nativeLanguageCode, 
  addressURL,
  addressEmbedHTML, // Custom embed HTML for Google Maps
  showMap = false,
  showMapButton = false,
  poiSlug = null, // For POI-specific address lookup
}) => {
  const { language } = useLanguage();
  const theme = useTheme();
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [speechDialogOpen, setSpeechDialogOpen] = useState(false);

  // Get hub configuration for speech button
  const hubConfig = getHubConfigByLanguage(language);

  // Get native address
  let nativeAddress = null;
  
  if (nativeLanguageCode && nativeLanguageCode !== language) {
    const nativeSuiteData = getSuiteData(suiteId, nativeLanguageCode);
    
    if (poiSlug) {
      // For POI: find the POI in native language data
      const pickedPOIs = nativeSuiteData?.details?.data?.[0]?.ownedBy?.pickedPOIs;
      const nativePOI = pickedPOIs?.find(poi => poi.slug === poiSlug);
      nativeAddress = nativePOI?.address;
    } else {
      // For suite: get suite address in native language
      nativeAddress = nativeSuiteData?.details?.data?.[0]?.address;
    }
  }

  // Copy to clipboard function
  const copyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setSnackbarMessage(`${label} copied to clipboard!`);
      setSnackbarOpen(true);
    } catch (err) {
      console.error('Failed to copy: ', err);
      setSnackbarMessage('Failed to copy address');
      setSnackbarOpen(true);
    }
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  // Speech dialog handlers
  const handleSpeechDialogOpen = () => {
    setSpeechDialogOpen(true);
  };

  const handleSpeechDialogClose = () => {
    // Stop any ongoing speech synthesis
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeechDialogOpen(false);
  };

  // Helper function to ensure voices are loaded (important for iOS)
  const ensureVoicesLoaded = (callback) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      callback(voices);
    } else {
      // Wait for voices to load
      const handleVoicesChanged = () => {
        const loadedVoices = window.speechSynthesis.getVoices();
        if (loadedVoices.length > 0) {
          window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
          callback(loadedVoices);
        }
      };
      window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
      
      // Fallback timeout
      setTimeout(() => {
        window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
        callback(window.speechSynthesis.getVoices());
      }, 3000);
    }
  };

  // Web Speech API function
  const speakAddress = (text, languageCode) => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      // Enhanced language handling for iOS
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      
      // Wait a bit for cancellation to complete on iOS
      setTimeout(() => {
        ensureVoicesLoaded((voices) => {
          const utterance = new SpeechSynthesisUtterance(text);
          
          if (isIOS) {
            // For iOS, we need to be more specific with language codes
            // and ensure we select a Japanese voice
            
            // Find Japanese voices specifically
            const japaneseVoices = voices.filter(voice => 
              voice.lang.startsWith('ja') || 
              voice.lang.includes('jp') ||
              voice.name.toLowerCase().includes('japanese') ||
              voice.name.toLowerCase().includes('kyoko') ||
              voice.name.toLowerCase().includes('otoya')
            );
            
            if (japaneseVoices.length > 0) {
              // Use the first available Japanese voice
              utterance.voice = japaneseVoices[0];
              utterance.lang = japaneseVoices[0].lang;
              console.log('Using Japanese voice:', japaneseVoices[0].name, japaneseVoices[0].lang);
            } else {
              // Fallback: try common Japanese language codes
              const japaneseLanguageCodes = ['ja-JP', 'ja', 'ja-jp'];
              for (const code of japaneseLanguageCodes) {
                const voice = voices.find(v => v.lang === code);
                if (voice) {
                  utterance.voice = voice;
                  utterance.lang = code;
                  console.log('Using fallback Japanese voice:', voice.name, code);
                  break;
                }
              }
              
              // If no Japanese voice found, still set the language
              if (!utterance.voice) {
                utterance.lang = 'ja-JP';
                console.log('No Japanese voice found, using language code: ja-JP');
              }
            }
          } else {
            // For non-iOS devices, use the original approach
            utterance.lang = languageCode;
          }
          
          utterance.rate = 0.8; // Slightly slower for clarity
          utterance.pitch = 1.0;
          
          // Add error handling
          utterance.onerror = (event) => {
            console.error('Speech synthesis error:', event.error);
          };
          
          utterance.onend = () => {
            console.log('Speech synthesis completed');
          };
          
          window.speechSynthesis.speak(utterance);
        });
      }, isIOS ? 100 : 0);
    } else {
      setSnackbarMessage('Speech synthesis not supported in this browser');
      setSnackbarOpen(true);
    }
  };

  return (
    <Box>
      {/* 1. Embedded Map */}
      {showMap && address && (
        <Box sx={{ mb: 3 }}>
          <Box
            sx={{
              width: '100%',
              height: '300px',
              borderRadius: 4,
              overflow: 'hidden',
              border: '1px solid #e0e0e0'
            }}
          >
            {addressEmbedHTML ? (
              <Box
                dangerouslySetInnerHTML={{ __html: addressEmbedHTML }}
                sx={{
                  width: '100%',
                  height: '100%',
                  '& iframe': {
                    width: '100% !important',
                    height: '100% !important',
                    border: 'none !important'
                  }
                }}
              />
            ) : (
              <iframe
                src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyAoc4RCOPkN2-oZt5OVt9lC7mJzmcaeV1Y&q=${encodeURIComponent(address)}`}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen=""
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Location Map"
              />
            )}
          </Box>
        </Box>
      )}

      {/* 2. Address with clipboard button */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Typography 
          variant="body1" 
          sx={{ 
            lineHeight: 1.6, 
            flex: 1, 
            mr: 1,
            fontFamily: 'Inter, sans-serif',
            fontWeight: 600,
            fontSize: '18px',
            color: '#605859'
          }}
        >
          {address}
        </Typography>
        <IconButton
          onClick={() => copyToClipboard(address, 'Address')}
          size="small"
          sx={{ color: 'primary.400' }}
          title="Copy address to clipboard"
        >
          <ContentCopyIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* 3. Native Language Address with clipboard button */}
      {nativeAddress && nativeAddress !== address && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box sx={{ flex: 1, mr: 1 }}>
            <Typography 
              variant="body2" 
              sx={{ 
                lineHeight: 1.6, 
                fontStyle: 'italic',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                fontSize: '18px',
                color: '#605859'
              }}
            >
              {nativeAddress}
            </Typography>
          </Box>
          <IconButton
            onClick={() => copyToClipboard(nativeAddress, 'Native address')}
            size="small"
            sx={{ color: 'primary.400' }}
            title="Copy native address to clipboard"
          >
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Box>
      )}

      {/* 4. Speech Button */}
      {nativeAddress && hubConfig?.data?.globalComponent?.speechButton && (
        <Box sx={{ mb: 3 }}>
          <Button
            variant="outlined"
            fullWidth
            startIcon={
              hubConfig.data.globalComponent.speechButton.icon?.url ? (
                <Box
                  component="img"
                  src={hubConfig.data.globalComponent.speechButton.icon.url}
                  alt="Speech"
                  sx={{ 
                    width: 18, 
                    height: 18
                  }}
                />
              ) : null
            }
            onClick={handleSpeechDialogOpen}
            sx={{ 
              py: 1.5,
              borderRadius: '37px',
              borderColor: theme.palette.primary.light, // Using primary[100] for border
              fontWeight: 600,
              fontSize: '16px',
              fontFamily: 'Commissioner, sans-serif',
              color: theme.palette.primary.light, // Using primary[100] for text
              '&:hover': {
                backgroundColor: 'primary.50',
                borderColor: theme.palette.primary.light
              }
            }}
          >
            {hubConfig.data.globalComponent.speechButton.label}
          </Button>
        </Box>
      )}


      {/* Speech Dialog */}
      {nativeAddress && hubConfig?.data?.globalComponent?.speechButton && (
        <Dialog
          open={speechDialogOpen}
          onClose={handleSpeechDialogClose}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pr: 1 }}>
            {hubConfig.data.globalComponent.speechButton.label}
            <IconButton
              onClick={handleSpeechDialogClose}
              size="small"
              sx={{ color: 'text.secondary' }}
              aria-label="close"
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <IconButton
                onClick={() => speakAddress(nativeAddress, nativeLanguageCode)}
                sx={{ 
                  color: 'primary.400', 
                  borderRadius: '50%', 
                  border: `3px solid ${theme.palette.primary.light}` // Using primary[100] for border
                }}
                size="large"
                title="Speak address"
              >
                {hubConfig.data.globalComponent.speechButton.icon?.url ? (
                  <Box
                    component="img"
                    src={hubConfig.data.globalComponent.speechButton.icon.url}
                    alt="Speech"
                    sx={{ 
                      width: 30, 
                      height: 30
                    }}
                  />
                ) : (
                  <span>🔊</span>
                )}
              </IconButton>
              <Typography 
                variant="h6" 
                sx={{ 
                  flex: 1, 
                  lineHeight: 1.6,
                  fontFamily: 'Commissioner, sans-serif',
                  fontWeight: 700,
                  fontSize: '24px',
                  color: '#605859'
                }}
              >
                {nativeAddress}
              </Typography>
            </Box>
          </DialogContent>
        </Dialog>
      )}

      {/* Snackbar for copy feedback */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleSnackbarClose} severity="success" sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AddressDisplay;
