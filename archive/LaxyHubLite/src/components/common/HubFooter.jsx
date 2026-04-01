import React from 'react';
import { CommonFooter } from '@laxy/components';  // ✅ Now this will work with Vite!
import { useLanguage } from '../../context/LanguageContext';
import { getHubConfigByLanguage } from '../../mocks/hub-application-config';

/**
 * LaxyHub-specific Footer that uses Hub configuration
 */
const HubFooter = (props) => {
  const { language } = useLanguage();
  
  // Get hub configuration for current language
  const hubConfig = getHubConfigByLanguage(language);
  const poweredByText = hubConfig?.data?.globalComponent?.poweredByLabel;
  // Hub-specific default styles
  const hubContainerStyle = {
    backgroundColor: '#f5f5f7',
    ...props.containerStyle
  };

  return (
    <CommonFooter 
      poweredByText={poweredByText}
      containerStyle={hubContainerStyle}
      {...props} 
    />
  );
};

export default HubFooter;
