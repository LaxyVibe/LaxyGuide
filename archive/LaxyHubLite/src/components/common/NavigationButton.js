import React from 'react';
import { Box, Typography } from '@mui/material';

const NavigationButton = ({
  icon,
  iconUrl,
  iconAlt,
  label,
  onClick,
  gridProps = { xs: 12 }, // Default to full width for flex layout
  iconSize = { xs: 24, sm: 28 },
  disabled = false,
  ...paperProps
}) => {
  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      height: '100%',
      width: '100%',
      textAlign: 'center',
      minWidth: 0 // Allow shrinking below content size
    }}>
      {/* Icon Container */}
      <Box sx={{ mb: { xs: 0.5, sm: 1 } }}>
        {iconUrl ? (
          <Box 
            component="img" 
            src={iconUrl} 
            alt={iconAlt || label}
            sx={{ 
              width: { xs: 50, sm: 63 }, // Responsive icon size
              height: { xs: 50, sm: 63 },
              display: 'block',
              cursor: disabled ? 'default' : 'pointer',
              opacity: disabled ? 0.6 : 1,
              transition: 'all 0.3s ease',
              '&:hover': disabled ? {} : {
                transform: 'translateY(-2px)',
              },
              ...paperProps.sx
            }}
            onClick={disabled ? undefined : onClick}
          />
        ) : (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: { xs: 50, sm: 63 }, // Responsive icon size
              height: { xs: 50, sm: 63 },
              cursor: disabled ? 'default' : 'pointer',
              opacity: disabled ? 0.6 : 1,
              transition: 'all 0.3s ease',
              '&:hover': disabled ? {} : {
                transform: 'translateY(-2px)',
              },
              ...paperProps.sx
            }}
            onClick={disabled ? undefined : onClick}
          >
            {icon}
          </Box>
        )}
      </Box>
      
      {/* Label Container with fixed height for alignment */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        minHeight: { xs: '28px', sm: '32px' }, // Responsive label height
        width: '100%'
      }}>
        {label && (
          <Typography 
            variant="caption" 
            color="text.secondary" 
            sx={{ 
              opacity: disabled ? 0.6 : 1,
              fontFamily: 'Commissioner, sans-serif',
              fontWeight: 400,
              fontSize: { xs: '13px', sm: '16px' }, // Responsive font size
              lineHeight: 1.2,
              textAlign: 'center',
              width: '100%',
              maxWidth: { xs: '50px', sm: '63px' },
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
              hyphens: 'auto',
              whiteSpace: 'normal'
            }}
          >
            {label}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default NavigationButton;