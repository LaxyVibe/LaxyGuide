import React from 'react';
import {
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  ListItemIcon,
  Typography,
  Box
} from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CheckIcon from '@mui/icons-material/Check';

/**
 * Reusable MenuList component for displaying menu items with consistent styling
 * 
 * @param {Object} props
 * @param {Array} props.items - Array of menu items to display
 * @param {Function} props.onItemClick - Callback function when an item is clicked
 * @param {boolean} props.showHeader - Whether to show a header (default: false)
 * @param {string} props.headerText - Header text to display
 * @param {boolean} props.showArrow - Whether to show right arrow (default: true)
 * @param {string} props.selectedValue - Value of the selected item to show check mark
 * @param {string} props.tickColor - Color for the check mark icon (default: 'primary.main')
 * @param {Object} props.sx - Additional styling
 * @returns {JSX.Element} The menu list component
 */
const MenuList = ({ 
  items = [], 
  onItemClick, 
  showHeader = false, 
  headerText = '',
  showArrow = true,
  selectedValue = null,
  tickColor = 'primary.main',
  sx = {} 
}) => {
  
  const handleItemClick = (item) => {
    if (onItemClick) {
      onItemClick(item);
    }
  };

  return (
    <Box sx={sx}>
      {showHeader && headerText && (
        <Typography 
          variant="h6" 
          component="h2" 
          sx={{ 
            mb: 2, 
            fontWeight: 600,
            fontSize: '1.1rem'
          }}
        >
          {headerText}
        </Typography>
      )}
      
      <List disablePadding>
        {items.map((item, index) => {
          const itemValue = item.value || item.id || item.label || item.name || item.title;
          const isSelected = selectedValue && itemValue === selectedValue;
          
          return (
            <ListItem key={item.id || item.value || index} disablePadding>
              <ListItemButton
                onClick={() => handleItemClick(item)}
                sx={{
                  py: 2,
                  px: 0,
                  borderBottom: index < items.length - 1 ? '1px solid rgba(0, 0, 0, 0.08)' : 'none',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.04)',
                  },
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  {selectedValue && (
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      {isSelected ? (
                        <CheckIcon sx={{ color: tickColor }} />
                      ) : (
                        <Box sx={{ width: 24, height: 24 }} />
                      )}
                    </ListItemIcon>
                  )}
                  <ListItemText 
                    primary={item.label || item.name || item.title}
                    primaryTypographyProps={{
                      fontWeight: 500
                    }}
                  />
                </Box>
                {showArrow && (
                  <ChevronRightIcon 
                    sx={{ 
                      color: 'rgba(0, 0, 0, 0.4)',
                      fontSize: '1.2rem'
                    }} 
                  />
                )}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
};

export default MenuList;