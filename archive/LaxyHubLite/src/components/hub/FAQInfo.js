import React from 'react';
import {
  Container,
  Typography,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import { useParams } from 'react-router-dom';
import PageHeader from '../common/PageHeader';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useLanguage } from '../../context/LanguageContext';
import { getSuiteData } from '../../utils/suiteUtils';
import { getHubConfigByLanguage } from '../../mocks/hub-application-config';
import { PAGE_LAYOUTS } from '../../config/layout';

const FAQInfo = () => {
  const params = useParams();
  const { language } = useLanguage();
  
  const suiteId = params.suiteId;
  
  // Get suite data
  const suiteData = getSuiteData(suiteId, language);
  const suite = suiteData?.details?.data?.[0];

  // Get hub configuration and find the FAQ navigation item
  const hubConfig = getHubConfigByLanguage(language);
  const faqNavItem = hubConfig?.data?.pageInfo?.navigation?.find(item => item.route === "/info/faq");
  const pageTitle = faqNavItem?.label || "Frequently Asked Questions";

  const faqItems = suite.faq || [];

  return (
    <Container {...PAGE_LAYOUTS.FAQInfo} sx={{ px: 3 }}> {/* 24px horizontal margin for whole content */}
      <PageHeader title={pageTitle} />
      {faqItems.map((faqItem, index) => (
          <Accordion 
            key={faqItem.id || index} 
            sx={{ 
              mb: 1,
              backgroundColor: 'transparent',
              boxShadow: 'none',
              '&:before': {
                display: 'none',
              },
              ...(index > 0 && {
                borderTop: '1px solid rgba(0, 0, 0, 0.12)',
                pt: 2
              })
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls={`faq-content-${index}`}
              id={`faq-header-${index}`}
              sx={{ backgroundColor: 'transparent' }}
            >
              <Typography variant="subtitle1" fontWeight="medium">
                {faqItem.question}
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ backgroundColor: 'transparent', pt: 1, pb: 2 }}>
              {typeof faqItem.answer === 'string' && faqItem.answer.includes('<') ? (
                <Box 
                  sx={{ 
                    lineHeight: 1.8,
                    textAlign: 'justify',
                    '& p': { mb: 2, textAlign: 'justify' },
                    '& strong': { fontWeight: 'bold', color: 'primary.main' },
                    '& ul, & ol': { pl: 2, mb: 2 },
                    '& li': { mb: 1, textAlign: 'justify' }
                  }}
                  dangerouslySetInnerHTML={{ __html: faqItem.answer }}
                />
              ) : (
                <Typography variant="body1" sx={{ lineHeight: 1.6, textAlign: 'justify' }}>
                  {faqItem.answer}
                </Typography>
              )}
            </AccordionDetails>
          </Accordion>
        ))}
    </Container>
  );
};

export default FAQInfo;
