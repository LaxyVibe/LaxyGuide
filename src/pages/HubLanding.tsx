import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import ReactGA from 'react-ga4';
import { useGuideData } from '../hooks/useGuideData';
import { useTranslation } from '../hooks/useTranslation';
import { getGuideAvailableLanguages } from '../utils/contentLoader';
import { ensureLanguageParam, getLanguageFromQuery, setLanguageInQuery } from '../utils/languageUtils';
import { LANGUAGES, type Language } from '../types';
import LanguageSwitchDialog, { type LanguageOption } from '../components/LanguageSwitchDialog';
import Loading from '../components/Loading';
import HubActionNav, { type HubActionItem } from '../components/hub/HubActionNav';
import HubFeaturedCards from '../components/hub/HubFeaturedCards';
import './HubLanding.css';
import '../guides/JPN-USAA-TEM-001/hub/styles/HubLanding.usaa.css';
import basicInfoIcon from '../guides/JPN-USAA-TEM-001/hub/assets/basic-info.svg';
import mapIcon from '../guides/JPN-USAA-TEM-001/hub/assets/map.svg';
import spotIcon from '../guides/JPN-USAA-TEM-001/hub/assets/spot.svg';
import museumIcon from '../guides/JPN-USAA-TEM-001/hub/assets/museum.svg';
import guideNumberIcon from '../guides/JPN-USAA-TEM-001/hub/assets/guide-number.svg';
import heroLocalImage from '../guides/JPN-USAA-TEM-001/hub/assets/hero-local.jpg';
import bannerLocalImage from '../guides/JPN-USAA-TEM-001/hub/assets/banner-local.jpg';
import heroTitleLogo from '../guides/JPN-USAA-TEM-001/hub/assets/hero-title-logo.png';
import translateIcon from '../assets/icons/language-black.svg';

const USAA_HUB_GUIDE_ID = 'JPN-USAA-TEM-001';

const HubLanding: React.FC = () => {
    const { guideId } = useParams<{ guideId: string }>();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [isLangDialogOpen, setIsLangDialogOpen] = useState(false);
    const [pendingLang, setPendingLang] = useState<Language>('en-US');
    const [availableLanguages, setAvailableLanguages] = useState<LanguageOption[]>([]);

    useEffect(() => {
        const defaultLang = ensureLanguageParam(searchParams);
        if (defaultLang) {
            setSearchParams(setLanguageInQuery(searchParams, defaultLang), { replace: true });
        }
    }, [searchParams, setSearchParams]);

    const lang = getLanguageFromQuery(searchParams);
    const { data, loading, error } = useGuideData(guideId, lang);
    const { t, loading: transLoading } = useTranslation(lang);
    const normalizedGuideId = guideId?.toUpperCase();
    const isHubGuide = normalizedGuideId === USAA_HUB_GUIDE_ID;

    useEffect(() => {
        setPendingLang(lang);
    }, [lang]);

    useEffect(() => {
        const fetchLanguages = async () => {
            if (!guideId) return;
            const langs = await getGuideAvailableLanguages(guideId);
            const options: LanguageOption[] = langs
                .filter((code): code is Language => code in LANGUAGES)
                .map((code) => ({
                    code,
                    label: LANGUAGES[code]
                }));
            setAvailableLanguages(options);
        };
        fetchLanguages();
    }, [guideId]);

    const baseQuery = useMemo(() => {
        const q = new URLSearchParams(searchParams);
        q.set('t', lang);
        return q.toString();
    }, [searchParams, lang]);

    const listQuery = (scope?: '0' | '1') => {
        const q = new URLSearchParams(searchParams);
        q.set('t', lang);
        if (scope) {
            q.set('scope', scope);
        } else {
            q.delete('scope');
        }
        return q.toString();
    };

    const trackHubAction = (action: string) => {
        ReactGA.event({
            category: 'Navigation',
            action,
            label: guideId
        });
    };

    const actionItems: HubActionItem[] = [
        {
            key: 'basicInfo',
            label: t('hub.basicInfo', 'Basic Info'),
            iconSrc: isHubGuide ? basicInfoIcon : undefined,
            onClick: () => {
                trackHubAction('Hub Basic Info');
                navigate(`/${guideId}/basic-info?${baseQuery}`);
            }
        },
        {
            key: 'map',
            label: t('hub.map', 'Map'),
            iconSrc: isHubGuide ? mapIcon : undefined,
            onClick: () => {
                trackHubAction('Hub Map');
                navigate(`/${guideId}/map?${baseQuery}`);
            }
        },
        {
            key: 'spot',
            label: t('hub.spot', 'Spot'),
            iconSrc: isHubGuide ? spotIcon : undefined,
            onClick: () => {
                trackHubAction('Hub Spot');
                navigate(`/${guideId}/list?${isHubGuide ? listQuery('0') : listQuery()}`);
            }
        },
        {
            key: 'museum',
            label: t('hub.museum', 'Museum'),
            iconSrc: isHubGuide ? museumIcon : undefined,
            onClick: () => {
                trackHubAction('Hub Museum');
                navigate(`/${guideId}/list?${isHubGuide ? listQuery('1') : listQuery()}`);
            }
        },
        {
            key: 'guideNumber',
            label: t('hub.guideNumber', 'Guide Number'),
            iconSrc: isHubGuide ? guideNumberIcon : undefined,
            onClick: () => {
                trackHubAction('Hub Guide Number');
                navigate(`/${guideId}/search?${baseQuery}`);
            }
        }
    ];

    const featuredItems = useMemo(() => {
        if (!data) return [];
        return data.pois.slice(0, 3).map((poi) => ({
            id: poi.number,
            title: poi.title,
            image: poi.hero,
            onClick: () => {
                ReactGA.event({
                    category: 'Navigation',
                    action: 'Hub Featured POI',
                    label: `${guideId}:${poi.number}`
                });
                navigate(`/${guideId}/${poi.number}?${baseQuery}`);
            }
        }));
    }, [data, guideId, navigate, baseQuery]);

    const usaaFeaturedItems = useMemo(() => {
        if (!isHubGuide) return featuredItems;

        const list = featuredItems.slice(0, 2);
        if (list.length === 2) return list;

        if (list.length === 1) {
            return [
                list[0],
                {
                    id: '002',
                    title: t('hub.moreSpots', 'More Spots'),
                    image: bannerLocalImage,
                    onClick: () => navigate(`/${guideId}/list?${listQuery('0')}`)
                }
            ];
        }

        return [];
    }, [isHubGuide, featuredItems, t, guideId, navigate, searchParams, lang]);

    if (loading || transLoading) return <Loading />;
    if (error) return <div>{t('common.error')}: {error}</div>;
    if (!data) return <div>{t('common.noData')}</div>;

    const pageTitle = `${data.guideTitle} | ${t('hub.pageTitle', 'Hub')}`;
    const heroImage = isHubGuide ? heroLocalImage : data.guideUnderlayImage;

    const pageClassName = `page hub-landing${isHubGuide ? ' hub-landing--jpn-usaa-tem-001' : ''}`;

    return (
        <div className={pageClassName}>
            <Helmet>
                <title>{pageTitle}</title>
                <meta name="description" content={pageTitle} />
                <meta property="og:title" content={pageTitle} />
                <meta property="og:description" content={pageTitle} />
                <meta property="og:image" content={heroImage} />
                <meta property="og:type" content="website" />
            </Helmet>

            <div className="hub-content-shell">
            <div className="hub-hero" style={{ backgroundImage: `url(${heroImage})` }}>
                <div className="hub-hero-overlay" />
                <div className="hub-hero-top">
                    <button
                        type="button"
                        className="hub-lang-btn"
                        onClick={() => setIsLangDialogOpen(true)}
                        aria-label={t('hub.language', 'Language')}
                    >
                        <img src={translateIcon} alt={t('hub.language', 'Language')} className="hub-lang-btn-icon" />
                    </button>
                </div>
                <div className="hub-hero-brand" aria-label={data.guideTitle}>
                    <img src={heroTitleLogo} alt={data.guideTitle} className="hub-title-logo" />
                </div>
            </div>

            <div className="scroll-content hub-scroll-content">
                <HubActionNav items={actionItems} />
                {isHubGuide && (
                    <section className="hub-banner-section" aria-label={t('hub.bannerLabel', 'Banner')}>
                        <img src={bannerLocalImage} alt={t('hub.bannerLabel', 'Banner')} />
                    </section>
                )}

                <HubFeaturedCards
                    heading={t('hub.recommended', 'Recommended Spots')}
                    items={isHubGuide ? usaaFeaturedItems : featuredItems}
                    variant={isHubGuide ? 'grid' : 'default'}
                    showIdBadge={isHubGuide}
                />

                <div className="hub-powered-by">
                    <span>{t('landing.poweredBy')}</span>
                    {isHubGuide ? (
                        <span className="hub-powered-by-logo-usaa" role="img" aria-label="Laxy Logo" />
                    ) : (
                        <img
                            src="https://res.cloudinary.com/dui2mxeuh/image/upload/v1764482353/logo_invert_1_gpalmw.svg"
                            alt="Laxy Logo"
                        />
                    )}
                </div>
            </div>
            </div>

            <LanguageSwitchDialog
                open={isLangDialogOpen}
                languages={availableLanguages}
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

export default HubLanding;
