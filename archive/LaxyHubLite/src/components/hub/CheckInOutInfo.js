import React from 'react';
import {
  Container,
  Typography,
  Box
} from '@mui/material';
import { useParams } from 'react-router-dom';
import PageHeader from '../common/PageHeader';
import { useLanguage } from '../../context/LanguageContext';
import { getSuiteData } from '../../utils/suiteUtils';
import { getHubConfigByLanguage } from '../../mocks/hub-application-config';
import { PAGE_LAYOUTS } from '../../config/layout';

const CheckInOutInfo = () => {
  const params = useParams();
  const { language } = useLanguage();
  
  const suiteId = params.suiteId;
  
  // Get suite data
  const suiteData = getSuiteData(suiteId, language);
  const suite = suiteData?.details?.data?.[0];

  // Get hub configuration and find the Check-in & Check-out navigation item
  const hubConfig = getHubConfigByLanguage(language);
  const checkInOutNavItem = hubConfig?.data?.pageInfo?.navigation?.find(item => item.route === "/info/check-in-out");
  const pageTitle = checkInOutNavItem?.label;

  if (!suite) {
    return (
      <Container {...PAGE_LAYOUTS.CheckInOutInfo} sx={{ px: 3 }}>
        <PageHeader title={pageTitle} />
        <Typography variant="h6">Suite information not found</Typography>
      </Container>
    );
  }

  return (
    <Container {...PAGE_LAYOUTS.CheckInOutInfo} sx={{ px: 3 }}> {/* 24px horizontal margin for whole content */}
      <PageHeader title={pageTitle} />
      <Box 
        sx={{ 
          lineHeight: 1.8,
          textAlign: 'justify',
          '& p': { mb: 2, textAlign: 'justify' },
          '& strong': { fontWeight: 'bold', color: 'primary.main' },
          '& ul, & ol': { pl: 2, mb: 2 },
          '& li': { mb: 1, textAlign: 'justify' }
        }}
        dangerouslySetInnerHTML={{ __html: suite.checkInOut || 'No check-in/check-out information available.' }}
      />
    </Container>
  );
};

export default CheckInOutInfo;
