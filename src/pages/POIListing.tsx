import React, { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useGuideData } from '../hooks/useGuideData';
import { useTranslation } from '../hooks/useTranslation';
import GlobalHeader from '../components/GlobalHeader';
import PoiList from '../components/PoiList';
import LanguageButton from '../components/LanguageButton';
import { ensureLanguageParam, getLanguageFromQuery, setLanguageInQuery } from '../utils/languageUtils';
import Loading from '../components/Loading';

const POIListing: React.FC = () => {
    const { guideId } = useParams<{ guideId: string }>();
    const [searchParams, setSearchParams] = useSearchParams();

    useEffect(() => {
        const defaultLang = ensureLanguageParam(searchParams);
        if (defaultLang) {
            setSearchParams(setLanguageInQuery(searchParams, defaultLang), { replace: true });
        }
    }, [searchParams, setSearchParams]);

    const lang = getLanguageFromQuery(searchParams);
    const { data, loading, error } = useGuideData(guideId, lang);
    const { t, loading: transLoading } = useTranslation(lang);

    if (loading || transLoading) return <Loading />;
    if (error) return <div>{t('common.error')}: {error}</div>;
    if (!data) return <div>{t('common.noData')}</div>;

    return (
        <div className="page poi-listing">
            <div style={{ flexShrink: 0, zIndex: 10, background: 'var(--neutral-100)' }}>
                <GlobalHeader title={t('poiListing.title')} showBack={true} />
                <div className="header-actions" style={{ padding: '0 20px 10px' }}>
                    <LanguageButton />
                </div>
            </div>
            <div className="scroll-content">
                <PoiList pois={data.pois} />
            </div>
        </div>
    );
};

export default POIListing;
