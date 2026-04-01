import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Typography,
  Box,
  IconButton,
  Snackbar,
  Button,
  useTheme
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import WifiIcon from '@mui/icons-material/Wifi';
import QRCode from 'react-qr-code';
import { useLanguage } from '../../context/LanguageContext';
import { getHubConfigByLanguage } from '../../mocks/hub-application-config';
import { getSuiteData } from '../../utils/suiteUtils';
import { trackButtonClick, trackContentInteraction } from '../../utils/analytics';

const WifiDialog = ({ open, onClose, suiteId }) => {
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [copyAlert, setCopyAlert] = useState(false);
  const [copiedNetworkName, setCopiedNetworkName] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const { language } = useLanguage();
  const theme = useTheme();
  
  // Get hub configuration for current language
  const hubConfig = getHubConfigByLanguage(language);
  
  // Get WiFi page labels from configuration
  const networkLabel = hubConfig?.data?.pageWiFi?.networkLabel || 'Network';
  const passwordLabel = hubConfig?.data?.pageWiFi?.passwordLabel || 'Password';
  
  // Get suite data for the current suite and language
  const suiteData = getSuiteData(suiteId, language);
  const wifiNetworks = suiteData?.details?.data?.[0]?.wifi || [];

  const handleShowQR = (network) => {
    trackButtonClick('qr_code_view', 'wifi_dialog');
    trackContentInteraction('qr_code_display', 'wifi_network', network.network);
    
    setSelectedNetwork(network);
    setQrDialogOpen(true);
  };

  const handleCloseQrDialog = () => {
    trackButtonClick('close_qr_dialog', 'wifi_dialog');
    
    setQrDialogOpen(false);
    setSelectedNetwork(null);
  };

  const handleCopyPassword = (password, networkName) => {
    if (!password) return;
    
    trackButtonClick('copy_password', 'wifi_dialog');
    trackContentInteraction('password_copy', 'wifi_network', networkName || 'unknown');
    
    navigator.clipboard.writeText(password);
    setCopiedNetworkName(networkName);
    setCopyAlert(true);
  };

  const handleClose = () => {
    trackButtonClick('close_wifi_dialog', 'wifi_dialog');
    onClose();
  };

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ flex: 1 }} /> {/* Spacer for centering */}
            <IconButton onClick={handleClose} sx={{ position: 'absolute', right: 16, top: 16 }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center', pb: 4 }}>
          {/* Large WiFi Icon in Circle */}
          <Box 
            sx={{ 
              width: 120, 
              height: 120, 
              borderRadius: '50%', 
              border: '8px solid',
              borderColor: theme.palette.primary.light,
              backgroundColor: 'transparent',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              mx: 'auto',
              mb: 3
            }}
          >
            <WifiIcon sx={{ fontSize: 60, color: theme.palette.primary.light }} />
          </Box>

          {/* Network Display */}
          <Typography variant="h6" sx={{ mb: 4, color: 'text.primary' }}>
            {networkLabel}: {wifiNetworks.map(network => network.network).join(' / ')}
          </Typography>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxWidth: 400, mx: 'auto' }}>
            {/* Network-specific action buttons */}
            {wifiNetworks.map((network, index) => (
              <React.Fragment key={index}>
                {/* Copy Password Button */}
                {network.password && (
                  <Button
                    variant="outlined"
                    onClick={() => handleCopyPassword(network.password, network.network)}
                    fullWidth
                    sx={{ 
                      borderRadius: '37px',
                      textTransform: 'none',
                      fontSize: '16px',
                      borderColor: theme.palette.primary.light,
                      color: theme.palette.primary.light,
                      '&:hover': {
                        backgroundColor: 'primary.50',
                        borderColor: theme.palette.primary.light
                      }
                    }}
                  >
                    {(hubConfig?.data?.pageWiFi?.clipboardButton?.label || 'Copy Password for "{{value}}"').replace('{{value}}', network.network)}
                  </Button>
                )}
                
                {/* Show QR Code Button */}
                <Button
                  variant="outlined"
                  onClick={() => handleShowQR(network)}
                  fullWidth
                  sx={{ 
                    borderRadius: '37px',
                    textTransform: 'none',
                    fontSize: '16px',
                    borderColor: theme.palette.primary.light,
                    color: theme.palette.primary.light,
                    '&:hover': {
                      backgroundColor: 'primary.50',
                      borderColor: theme.palette.primary.light
                    },
                    mb: index < wifiNetworks.length - 1 ? 1 : 0
                  }}
                >
                  {hubConfig?.data?.pageWiFi?.showQRButton?.label}
                </Button>
              </React.Fragment>
            ))}
          </Box>
        </DialogContent>
      </Dialog>

      {/* Dialog for WiFi QR */}
      <Dialog open={qrDialogOpen} onClose={handleCloseQrDialog} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              {selectedNetwork ? `${selectedNetwork.network}` : hubConfig?.data?.pageWiFi?.showQRButton?.label}
            </Typography>
            <IconButton onClick={handleCloseQrDialog}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box textAlign="center" sx={{ py: 2 }}>
            {selectedNetwork && (
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                mb: 2,
                padding: 2,
                backgroundColor: 'white',
                borderRadius: 2,
                border: '1px solid #e0e0e0'
              }}>
                <QRCode
                  value={`WIFI:S:${selectedNetwork.network};T:${selectedNetwork.password ? 'WPA' : 'nopass'};P:${selectedNetwork.password || ''};;`}
                  size={200}
                  level="M"
                />
              </Box>
            )}
            <Typography variant="body1" sx={{ mb: 1 }}>
              {networkLabel}: {selectedNetwork?.network}
            </Typography>
            {selectedNetwork?.password && (
              <Typography variant="body2" color="textSecondary">
                {passwordLabel}: {selectedNetwork.password}
              </Typography>
            )}
            <Typography variant="body2" sx={{ mt: 2 }}>
              {hubConfig?.data?.pageWiFi?.scanQRButton?.label}
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>
      
      {/* Copy success notification */}
      <Snackbar
        open={copyAlert}
        autoHideDuration={2000}
        onClose={() => setCopyAlert(false)}
        message={`Password copied for ${copiedNetworkName}!`}
      />
    </>
  );
};

export default WifiDialog;
