import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';
import { useGuideData } from '../hooks/useGuideData';
import GlobalHeader from '../components/GlobalHeader';
import { getLanguageFromQuery, ensureLanguageParam, setLanguageInQuery } from '../utils/languageUtils';
import Loading from '../components/Loading';
import LanguageSwitchDialog from '../components/LanguageSwitchDialog';
import { LANGUAGES, type Language } from '../types';
import translateIcon from '../assets/icons/language-black.svg';
import './POISearch.css';

const POISearch: React.FC = () => {
    const { guideId } = useParams<{ guideId: string }>();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [guideNumber, setGuideNumber] = useState('');

    useEffect(() => {
        const defaultLang = ensureLanguageParam(searchParams);
        if (defaultLang) {
            setSearchParams(setLanguageInQuery(searchParams, defaultLang), { replace: true });
        }
    }, [searchParams, setSearchParams]);

    const lang = getLanguageFromQuery(searchParams);
    const { data, loading } = useGuideData(guideId, lang);
    const { t, loading: transLoading } = useTranslation(lang);
    const [langDialogOpen, setLangDialogOpen] = useState(false);
    const [selectedLang, setSelectedLang] = useState<Language>(lang);

    const handleNumberClick = (num: string) => {
        if (guideNumber.length < 3) {
            setGuideNumber(guideNumber + num);
        }
    };

    const handleDelete = () => {
        setGuideNumber(guideNumber.slice(0, -1));
    };

    const handleVisit = () => {
        if (guideNumber.length === 3 && data) {
            // Find the POI with this guide number
            const poi = data.pois.find(p => p.number === guideNumber);
            if (poi) {
                // Navigate to POI detail with current language
                navigate(`/${guideId}/${guideNumber}?${searchParams.toString()}`);
            }
        }
    };

    if (loading || transLoading) return <Loading />;

    // Find the matching POI for display
    const matchingPoi = data?.pois.find(p => p.number === guideNumber);

    return (
        <div className="page poi-search">
            <div className="poi-search-header">
                <GlobalHeader title={t('poiSearch.title')} showBack={true} />
                <div className="header-actions">
                    <button
                        className="icon-button"
                        aria-label={t('poiSearch.languageButton')}
                        onClick={() => {
                            setSelectedLang(lang);
                            setLangDialogOpen(true);
                        }}
                    >
                        <img src={translateIcon} alt={t('poiSearch.languageButton')} />
                    </button>
                        <LanguageSwitchDialog
                        open={langDialogOpen}
                        languages={Object.entries(LANGUAGES).map(([code, label]) => ({ code, label }))}
                        selectedLanguage={selectedLang}
                            onSelect={(code: string) => setSelectedLang(code as Language)}
                        onApply={() => {
                            setSearchParams(setLanguageInQuery(searchParams, selectedLang), { replace: true });
                            setLangDialogOpen(false);
                        }}
                        onClose={() => setLangDialogOpen(false)}
                    />
                </div>
            </div>
            <div className="scroll-content">
                <div className="search-content">
                    {/* Guide Number Display */}
                    <div className="guide-number-display">
                        {guideNumber.padEnd(3, '_').split('').map((char, index) => (
                            <span key={index} className={`digit ${char === '_' ? 'empty' : ''}`}>
                                {char === '_' ? '' : char}
                            </span>
                        ))}
                    </div>

                    {/* Prompt */}
                    <div className="search-prompt">
                        {t('poiSearch.prompt')}
                    </div>

                    {/* Matching POI Display */}
                    {matchingPoi && (
                        <div className="matching-poi">
                            <img src={matchingPoi.hero} alt={matchingPoi.title} />
                            <div className="poi-info">
                                <div className="poi-title">{matchingPoi.title}</div>
                                {matchingPoi.metadata && matchingPoi.metadata.length > 0 && (
                                    <div className="poi-subtitle">{matchingPoi.metadata[0].value}</div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Visit Button */}
                    <button
                        className={`visit-button ${guideNumber.length === 3 && matchingPoi ? 'active' : ''}`}
                        onClick={handleVisit}
                        disabled={guideNumber.length !== 3 || !matchingPoi}
                    >
                        {t('poiSearch.visit')}
                    </button>

                    {/* Numeric Keypad */}
                    <div className="numeric-keypad">
                        <div className="keypad-row">
                            <button className="key-button" onClick={() => handleNumberClick('1')}>
                                <span className="number">1</span>
                            </button>
                            <button className="key-button" onClick={() => handleNumberClick('2')}>
                                <span className="number">2</span>
                            </button>
                            <button className="key-button" onClick={() => handleNumberClick('3')}>
                                <span className="number">3</span>
                            </button>
                        </div>
                        <div className="keypad-row">
                            <button className="key-button" onClick={() => handleNumberClick('4')}>
                                <span className="number">4</span>
                            </button>
                            <button className="key-button" onClick={() => handleNumberClick('5')}>
                                <span className="number">5</span>
                            </button>
                            <button className="key-button" onClick={() => handleNumberClick('6')}>
                                <span className="number">6</span>
                            </button>
                        </div>
                        <div className="keypad-row">
                            <button className="key-button" onClick={() => handleNumberClick('7')}>
                                <span className="number">7</span>
                            </button>
                            <button className="key-button" onClick={() => handleNumberClick('8')}>
                                <span className="number">8</span>
                            </button>
                            <button className="key-button" onClick={() => handleNumberClick('9')}>
                                <span className="number">9</span>
                            </button>
                        </div>
                        <div className="keypad-row">
                            <button className="key-button empty"></button>
                            <button className="key-button" onClick={() => handleNumberClick('0')}>
                                <span className="number">0</span>
                            </button>
                            <button className="key-button delete" onClick={handleDelete} aria-label={t('poiSearch.delete')}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                    <path d="M22 3H7C6.31 3 5.77 3.35 5.41 3.88L0 12L5.41 20.11C5.77 20.64 6.31 21 7 21H22C23.1 21 24 20.1 24 19V5C24 3.9 23.1 3 22 3ZM19 15.59L17.59 17L14 13.41L10.41 17L9 15.59L12.59 12L9 8.41L10.41 7L14 10.59L17.59 7L19 8.41L15.41 12L19 15.59Z" fill="currentColor" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default POISearch;
