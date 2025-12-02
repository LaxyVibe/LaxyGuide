import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useGuideData } from '../hooks/useGuideData';
import { useTranslation } from '../hooks/useTranslation';
import GlobalHeader from '../components/GlobalHeader';
import PoiList from '../components/PoiList';
import LanguageSwitchDialog from '../components/LanguageSwitchDialog';
import type { LanguageOption } from '../components/LanguageSwitchDialog';
import { ensureLanguageParam, getLanguageFromQuery, setLanguageInQuery } from '../utils/languageUtils';
import type { Language } from '../types';
import Loading from '../components/Loading';
import gridIcon from '../assets/icons/grid.svg';
import translateIcon from '../assets/icons/language-black.svg';
import './POIListing.css';

const POIListing: React.FC = () => {
    const { guideId } = useParams<{ guideId: string }>();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [showLanguageDialog, setShowLanguageDialog] = useState(false);
    const [pendingLang, setPendingLang] = useState<Language>('en-US');

    useEffect(() => {
        const defaultLang = ensureLanguageParam(searchParams);
        if (defaultLang) {
            setSearchParams(setLanguageInQuery(searchParams, defaultLang), { replace: true });
        }
    }, [searchParams, setSearchParams]);

    const lang = getLanguageFromQuery(searchParams);
    const { data, loading, error } = useGuideData(guideId, lang);
    const { t, loading: transLoading } = useTranslation(lang);

    // Language options
    const languageOptions: LanguageOption[] = [
        { code: 'en-US', label: 'English' },
        { code: 'ja-JP', label: '日本語' },
        { code: 'ko-KR', label: '한국어' },
        { code: 'zh-TW', label: '繁體中文' },
        { code: 'zh-CN', label: '简体中文' },
    ];

    // Update pendingLang when lang changes
    useEffect(() => {
        setPendingLang(lang);
    }, [lang]);

    if (loading || transLoading) return <Loading />;
    if (error) return <div>{t('common.error')}: {error}</div>;
    if (!data) return <div>{t('common.noData')}</div>;

    return (
        <div className="page poi-listing">
            <div className="poi-listing-header">
                <GlobalHeader title={t('poiListing.title')} showBack={true} />
                <div className="header-actions">
                    <button
                        className="icon-button"
                        aria-label="Grid view"
                        onClick={() => navigate(`/${guideId}/search?${searchParams.toString()}`)}
                    >
                        <img src={gridIcon} alt="Grid" />
                    </button>
                    <button className="icon-button" aria-label="Change language" onClick={() => setShowLanguageDialog(true)}>
                        <img src={translateIcon} alt="Translate" />
                    </button>
                </div>
            </div>
            <div className="scroll-content">
                <PoiList pois={data.pois} />
            </div>
            <LanguageSwitchDialog
                open={showLanguageDialog}
                languages={languageOptions}
                selectedLanguage={pendingLang}
                onSelect={(code: string) => setPendingLang(code as Language)}
                onApply={() => {
                    setSearchParams(setLanguageInQuery(searchParams, pendingLang), { replace: true });
                    setShowLanguageDialog(false);
                }}
                onClose={() => setShowLanguageDialog(false)}
            />
        </div>
    );
};

export default POIListing;
