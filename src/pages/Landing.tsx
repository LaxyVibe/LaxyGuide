import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import '../Landing.css';
import { useParams, useSearchParams } from 'react-router-dom';
import surveyIcon from '../assets/icons/survey.svg';
import { ensureLanguageParam, getLanguageFromQuery, setLanguageInQuery } from '../utils/languageUtils';
import type { Language } from '../types';
import { useGuideData } from '../hooks/useGuideData';
import { useTranslation } from '../hooks/useTranslation';
import LanguageSwitchDialog from '../components/LanguageSwitchDialog';
import type { LanguageOption } from '../components/LanguageSwitchDialog';
import StartButton from '../components/StartButton';
import SurveyDialog from '../components/SurveyDialog';
import Loading from '../components/Loading';

const Landing: React.FC = () => {
    const { guideId } = useParams<{ guideId: string }>();
    const [searchParams, setSearchParams] = useSearchParams();

    // Ensure language param exists
    useEffect(() => {
        const defaultLang = ensureLanguageParam(searchParams);
        if (defaultLang) {
            setSearchParams(setLanguageInQuery(searchParams, defaultLang), { replace: true });
        }
    }, [searchParams, setSearchParams]);


    const lang = getLanguageFromQuery(searchParams);
    const { data, loading, error } = useGuideData(guideId, lang);
    const { t, loading: transLoading } = useTranslation(lang);
    const [isSurveyOpen, setIsSurveyOpen] = useState(false);
    const [isLangDialogOpen, setIsLangDialogOpen] = useState(false);
    const [pendingLang, setPendingLang] = useState<Language>(lang);

    // Language options (can be moved to a shared file if needed)
    const languageOptions: LanguageOption[] = [
        { code: 'en-US', label: 'English' },
        { code: 'ja-JP', label: '日本語' },
        { code: 'ko-KR', label: '한국어' },
        { code: 'zh-TW', label: '繁體中文' },
        { code: 'zh-CN', label: '简体中文' },
    ];

    if (loading || transLoading) return <Loading />;
    if (error) return <div>{t('common.error')}: {error}</div>;
    if (!data) return <div>{t('common.noData')}</div>;

    return (
        <div className="page landing" style={{ backgroundImage: `url(${data.guideUnderlayImage})` }}>
            <Helmet>
                <title>{t('meta.title')}</title>
                <meta name="description" content={t('meta.title')} />
                <meta property="og:title" content={t('meta.title')} />
                <meta property="og:description" content={t('meta.title')} />
                <meta property="og:image" content={data.guideUnderlayImage} />
                <meta property="og:type" content="website" />
            </Helmet>
            {/* Gradient overlay */}
            <div className="landing-gradient-overlay" style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }} />

            {/* Top bar: Survey icon button (top-right) */}
            <div style={{ position: 'absolute', top: 24, right: 24, zIndex: 100 }}>
                <button
                    className="survey-icon-btn"
                    aria-label="Survey"
                    style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(0, 0, 0, 0.3)', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
                    onClick={() => setIsSurveyOpen(true)}
                >
                    <img src={surveyIcon} alt="Survey" style={{ width: 28, height: 28, filter: 'brightness(0) invert(1)' }} />
                </button>
            </div>

            <div className="landing-content scroll-content" style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', width: '100%', padding: '20px 20px 80px 20px' }}>
                {/* Language Switcher Section */}
                <div style={{ width: '100%', maxWidth: 400, marginBottom: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: '100%', textAlign: 'left', color: 'var(--neutral-100)', fontWeight: 600, fontSize: 16, marginBottom: 8, textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>{t('landing.selectLanguage')}</div>
                    <button
                        className="lang-switch-btn"
                        style={{ height: 53, borderRadius: 24, border: 'none', background: 'rgba(245,245,245,0.95)', color: 'var(--neutral-800)', fontWeight: 'bold', fontSize: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', cursor: 'pointer', width: '100%' }}
                        onClick={() => setIsLangDialogOpen(true)}
                    >
                        <span>{languageOptions.find(l => l.code === lang)?.label || 'Select Language'}</span>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--misc-opam)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                    </button>
                </div>

                {/* Start Button */}
                <StartButton poiCount={data.pois.length} firstPoiId={data.pois.length === 1 ? data.pois[0].number : undefined} />
            </div>

            {/* Survey Dialog */}
            <SurveyDialog isOpen={isSurveyOpen} onClose={() => setIsSurveyOpen(false)} />

            {/* Footer with Powered by and SVG logo */}
            <div style={{ position: 'absolute', bottom: 48, left: 0, width: '100%', textAlign: 'center', zIndex: 2 }}>
                <span style={{ color: 'var(--neutral-100)', fontWeight: 500, fontSize: 16, marginRight: 0, verticalAlign: 'middle', textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>{t('landing.poweredBy')}</span>
                <img src="https://res.cloudinary.com/dui2mxeuh/image/upload/v1764482353/logo_invert_1_gpalmw.svg" alt="Laxy Logo" style={{ height: 24, verticalAlign: 'middle', filter: 'brightness(0) invert(1)' }} />
            </div>

            {/* Language Switch Dialog */}
            <LanguageSwitchDialog
                open={isLangDialogOpen}
                languages={languageOptions}
                selectedLanguage={pendingLang}
                onSelect={(code: string) => setPendingLang(code as Language)}
                onApply={() => {
                    setSearchParams(setLanguageInQuery(searchParams, pendingLang), { replace: true });
                    setIsLangDialogOpen(false);
                }}
                onClose={() => setIsLangDialogOpen(false)}
            />
        </div>
    );
};

export default Landing;
