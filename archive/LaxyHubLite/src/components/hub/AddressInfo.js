import React from 'react';
import {
  Container
} from '@mui/material';
import { useParams } from 'react-router-dom';
import PageHeader from '../common/PageHeader';
import { useLanguage } from '../../context/LanguageContext';
import { getSuiteData } from '../../utils/suiteUtils';
import { getHubConfigByLanguage } from '../../mocks/hub-application-config';
import AddressDisplay from '../common/AddressDisplay';
import { PAGE_LAYOUTS } from '../../config/layout';

const AddressInfo = () => {
  const params = useParams();
  const { language } = useLanguage();
  
  const suiteId = params.suiteId;

  // Get suite data in current language
  const suiteData = getSuiteData(suiteId, language);
  const suite = suiteData?.details?.data?.[0];

  // Get native language code
  const nativeLanguageCode = suite?.ownedBy?.nativeLanguageCode;

  // Get hub configuration and find the Address navigation item
  const hubConfig = getHubConfigByLanguage(language);
  const addressNavItem = hubConfig?.data?.pageInfo?.navigation?.find(item => item.route === "/info/address");
  const pageTitle = addressNavItem?.label;

  return (
    <Container {...PAGE_LAYOUTS.AddressInfo} sx={{ px: 3 }}> {/* 24px horizontal margin for whole content */}
      <PageHeader title={pageTitle} />
      <AddressDisplay
        suiteId={suiteId}
        address={suite.address}
        nativeLanguageCode={nativeLanguageCode}
        addressURL={suite.addressURL}
        addressEmbedHTML={suite.addressEmbedHTML}
        showMap={true}
        showMapButton={true}
      />
    </Container>
  );
};

export default AddressInfo;
