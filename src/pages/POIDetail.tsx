import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { useGuideData } from '../hooks/useGuideData';
import { useTranslation } from '../hooks/useTranslation';
import GlobalHeader from '../components/GlobalHeader';
import { useNavigate } from 'react-router-dom';
import ExpandableAudioPlayer from '../components/ExpandableAudioPlayer';
import '../components/DisplayItemDetail.css';
import surveyIcon from '../assets/icons/survey.svg';
import languageIcon from '../assets/icons/language.svg';
import { ensureLanguageParam, getLanguageFromQuery, setLanguageInQuery } from '../utils/languageUtils';
import SurveyDialog from '../components/SurveyDialog';
import LanguageSwitchDialog, { type LanguageOption } from '../components/LanguageSwitchDialog';
import type { Language } from '../types';
import Loading from '../components/Loading';

const POIDetail: React.FC = () => {
    const { guideId, poiId } = useParams<{ guideId: string; poiId: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    // Move hooks to top level to avoid "Rendered more hooks than during the previous render" error
    const [isScrolled, setIsScrolled] = React.useState(false);
    const scrollRef = React.useRef<HTMLDivElement>(null);

    // Dialog states
    const [isSurveyOpen, setIsSurveyOpen] = useState(false);
    const [isLangDialogOpen, setIsLangDialogOpen] = useState(false);
    const lang = getLanguageFromQuery(searchParams);
    const [pendingLang, setPendingLang] = useState<Language>(lang);

    // Language options
    const languageOptions: LanguageOption[] = [
        { code: 'en-US', label: 'English' },
        { code: 'ja-JP', label: '日本語' },
        { code: 'ko-KR', label: '한국어' },
        { code: 'zh-TW', label: '繁體中文' },
        { code: 'zh-CN', label: '简体中文' },
    ];

    useEffect(() => {
        const defaultLang = ensureLanguageParam(searchParams);
        if (defaultLang) {
            setSearchParams(setLanguageInQuery(searchParams, defaultLang), { replace: true });
        }
    }, [searchParams, setSearchParams]);

    useEffect(() => {
        const handleScroll = () => {
            if (scrollRef.current) {
                const scrollTop = scrollRef.current.scrollTop;
                const threshold = window.innerHeight * 0.4 - 80;
                setIsScrolled(scrollTop > threshold);
            }
        };

        const scrollElement = scrollRef.current;
        if (scrollElement) {
            scrollElement.addEventListener('scroll', handleScroll);
        }

        return () => {
            if (scrollElement) {
                scrollElement.removeEventListener('scroll', handleScroll);
            }
        };
    }, []);

    // Update pending lang when current lang changes
    useEffect(() => {
        setPendingLang(lang);
    }, [lang]);

    const { data, loading, error } = useGuideData(guideId, lang);
    const { t, loading: transLoading } = useTranslation(lang);

    if (loading || transLoading) return <Loading />;
    if (error) return <div className="error-container"><p>{t('common.error')}: {error}</p></div>;
    if (!data) return <div className="error-container"><p>{t('common.noData')}</p></div>;

    const poi = data.pois.find((p) => p.number === poiId);

    if (!poi) return <div className="error-container"><p>{t('poiDetail.notFound')}</p></div>;

    const handleBack = () => {
        if ('startViewTransition' in document) {
            document.startViewTransition(() => {
                if (data.pois.length === 1) {
                    navigate(`/${guideId}?t=${lang}`);
                } else {
                    navigate(-1);
                }
            });
        } else {
            if (data.pois.length === 1) {
                navigate(`/${guideId}?t=${lang}`);
            } else {
                navigate(-1);
            }
        }
    };

    return (
        <div className="page display-item-detail" style={{ padding: 0, background: 'var(--neutral-100)' }}>
            <Helmet>
                <title>{poi.title} - {t('meta.title')}</title>
                <meta name="description" content={poi.content ? poi.content.substring(0, 150) + '...' : poi.title} />
                <meta property="og:title" content={poi.title} />
                <meta property="og:description" content={poi.content ? poi.content.substring(0, 150) + '...' : poi.title} />
                <meta property="og:image" content={poi.hero} />
                <meta property="og:type" content="article" />
            </Helmet>
            {/* Fixed Hero Image */}
            <div className="hero-section" style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: 'calc(var(--vh, 1vh) * 45)',
                zIndex: 0
            }}>
                <img src={poi.hero} alt={poi.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '120px',
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)',
                    pointerEvents: 'none'
                }} />
            </div>

            {/* Fixed Global Header */}
            <GlobalHeader
                title=""
                showBack={true}
                onBack={handleBack}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    background: isScrolled ? 'rgba(245, 245, 245, 0.95)' : 'transparent',
                    backdropFilter: isScrolled ? 'blur(10px)' : 'none',
                    boxShadow: isScrolled ? '0 2px 10px rgba(0,0,0,0.1)' : 'none',
                    zIndex: 20,
                    transition: 'all 0.3s ease'
                }}
            />

            {/* Top Right Buttons (Survey & Language) */}
            <div style={{
                position: 'fixed',
                top: 16,
                right: 20,
                zIndex: 30,
                display: 'flex',
                gap: '12px'
            }}>
                {/* Survey Button */}
                <button
                    onClick={() => setIsSurveyOpen(true)}
                    style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: 'rgba(33, 36, 39, 0.5)',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        backdropFilter: 'blur(4px)',
                        WebkitBackdropFilter: 'blur(4px)',
                        color: 'white',
                        transition: 'transform 0.2s'
                    }}
                    onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                    onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                    <img src={surveyIcon} alt="Survey" style={{ width: 28, height: 28 }} />
                </button>

                {/* Language Button */}
                <button
                    onClick={() => setIsLangDialogOpen(true)}
                    style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: 'rgba(33, 36, 39, 0.5)',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        backdropFilter: 'blur(4px)',
                        WebkitBackdropFilter: 'blur(4px)',
                        color: 'white',
                        transition: 'transform 0.2s'
                    }}
                    onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                    onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                    <img src={languageIcon} alt="Language" style={{ width: 28, height: 28 }} />
                </button>
            </div>

            {/* Scrollable Content */}
            <div
                ref={scrollRef}
                className="scroll-content"
                style={{
                    position: 'relative',
                    zIndex: 10,
                    marginTop: 0, // Reset margin top, we will use padding or a spacer
                    height: 'calc(var(--vh, 1vh) * 100)', // Full height to allow scrolling
                    overflowY: 'auto',
                    background: 'transparent', // Transparent to show hero initially
                    overscrollBehaviorY: 'none' // Disable rubberband effect on iOS
                }}
            >
                {/* Spacer to push content down */}
                <div style={{ height: 'calc(var(--vh, 1vh) * 40)' }} />

                <div style={{
                    background: 'var(--neutral-100)',
                    borderRadius: '24px 24px 0 0',
                    padding: '24px 20px 120px 20px',
                    minHeight: 'calc(var(--vh, 1vh) * 60)',
                    boxShadow: '0 -4px 20px rgba(0,0,0,0.1)'
                }}>
                    <div className="detail-content" style={{ gridTemplateColumns: '1fr', gap: '20px' }}>
                        <div className="info-section" style={{ paddingTop: 0 }}>
                            <div className="item-header" style={{ marginBottom: '20px' }}>
                                <span className="item-number" style={{
                                    background: 'var(--misc-opam)',
                                    color: 'white',
                                    padding: '4px 12px',
                                    borderRadius: '4px',
                                    fontSize: '1rem',
                                    fontWeight: 'bold',
                                    display: 'inline-block',
                                    marginBottom: '12px',
                                    marginTop: '12px',
                                    marginRight: '12px',
                                    verticalAlign: 'middle'
                                }}>
                                    {poi.number}
                                </span>
                                <h1 className="item-title" style={{
                                    display: 'inline-block',
                                    verticalAlign: 'middle',
                                    fontSize: '1.8rem',
                                    margin: 0
                                }}>
                                    {poi.title}
                                </h1>
                            </div>

                            {poi.metadata && poi.metadata.length > 0 && (
                                <div className="item-meta" style={{ background: 'transparent', padding: 0, marginBottom: '24px' }}>
                                    {poi.metadata.map((item, index) => (
                                        <div key={index} className="meta-item" style={{
                                            display: 'grid',
                                            gridTemplateColumns: '100px 1fr',
                                            marginBottom: '8px',
                                            fontSize: '0.95rem'
                                        }}>
                                            <strong style={{ color: 'var(--misc-opam)' }}>{item.label}</strong>
                                            <span style={{ color: 'var(--neutral-800)' }}>{item.value}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="item-description">
                                <div className="description-content markdown-content" style={{ fontSize: '1rem', lineHeight: '1.8', color: 'var(--neutral-700)' }}>
                                    <ReactMarkdown>{poi.content}</ReactMarkdown>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Audio Player */}
            {poi.audio && (
                <ExpandableAudioPlayer
                    src={poi.audio}
                    subtitle={poi.subtitle}
                    title={poi.title}
                    artwork={poi.hero}
                />
            )}

            {/* Dialogs */}
            <SurveyDialog isOpen={isSurveyOpen} onClose={() => setIsSurveyOpen(false)} />
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

export default POIDetail;
