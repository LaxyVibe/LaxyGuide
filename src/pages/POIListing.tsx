import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useGuideData } from '../hooks/useGuideData';
import { useTranslation } from '../hooks/useTranslation';
import GlobalHeader from '../components/GlobalHeader';
import PoiList from '../components/PoiList';
import LanguageSwitchDialog from '../components/LanguageSwitchDialog';
import type { LanguageOption } from '../components/LanguageSwitchDialog';
import { ensureLanguageParam, getLanguageFromQuery, setLanguageInQuery } from '../utils/languageUtils';
import { LANGUAGES, type Language } from '../types';
import { getGuideAvailableLanguages } from '../utils/contentLoader';
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
    const [availableLanguages, setAvailableLanguages] = useState<LanguageOption[]>([]);

    useEffect(() => {
        const defaultLang = ensureLanguageParam(searchParams);
        if (defaultLang) {
            setSearchParams(setLanguageInQuery(searchParams, defaultLang), { replace: true });
        }
    }, [searchParams, setSearchParams]);

    const lang = getLanguageFromQuery(searchParams);
    const startWith = searchParams.get('startWith');
    const { data, loading, error } = useGuideData(guideId, lang);
    const { t, loading: transLoading } = useTranslation(lang);

    const filteredPois = useMemo(() => {
        if (!data) return [];
        if (startWith === '0' || startWith === '1') {
            return data.pois.filter((poi) => poi.number.startsWith(startWith));
        }
        return data.pois;
    }, [data, startWith]);

    // Fetch available languages for this guide
    useEffect(() => {
        const fetchLanguages = async () => {
            if (guideId) {
                const langs = await getGuideAvailableLanguages(guideId);
                const options: LanguageOption[] = langs
                    .filter((code): code is Language => code in LANGUAGES)
                    .map(code => ({
                        code,
                        label: LANGUAGES[code]
                    }));
                setAvailableLanguages(options);
            }
        };
        fetchLanguages();
    }, [guideId]);

    // Update pendingLang when lang changes
    useEffect(() => {
        setPendingLang(lang);
    }, [lang]);

    if (loading || transLoading) return <Loading />;
    if (error) return <div>{t('common.error')}: {error}</div>;
    if (!data) return <div>{t('common.noData')}</div>;

    const handleBack = () => {
        if ('startViewTransition' in document) {
            document.startViewTransition(() => {
                navigate(`/${guideId}?t=${lang}`);
            });
        } else {
            navigate(`/${guideId}?t=${lang}`);
        }
    };

    return (
        <div className="page poi-listing">
            <div className="poi-listing-header">
                <GlobalHeader title={t('poiListing.title')} showBack={true} onBack={handleBack} />
            </div>

            {/* Top Right Buttons (Grid & Language) */}
            <div style={{
                position: 'fixed',
                top: 16,
                right: 20,
                zIndex: 30,
                display: 'flex',
                gap: '12px'
            }}>
                {/* Grid Button */}
                <button
                    onClick={() => navigate(`/${guideId}/search?${searchParams.toString()}`)}
                    aria-label="Grid view"
                    style={{
                        width: '42px',
                        height: '42px',
                        background: 'rgba(245, 245, 245, 0.95)',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'transform 0.2s'
                    }}
                    onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                    onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                    <img src={gridIcon} alt="Grid" style={{ width: 42, height: 42 }} />
                </button>

                {/* Language Button */}
                <button
                    onClick={() => setShowLanguageDialog(true)}
                    aria-label="Change language"
                    style={{
                        width: '42px',
                        height: '42px',
                        background: 'rgba(245, 245, 245, 0.95)',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'transform 0.2s'
                    }}
                    onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                    onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                    <img src={translateIcon} alt="Translate" style={{ width: 42, height: 42 }} />
                </button>
            </div>

            <div className="scroll-content">
                <PoiList pois={filteredPois} />
            </div>
            <LanguageSwitchDialog
                open={showLanguageDialog}
                languages={availableLanguages}
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
