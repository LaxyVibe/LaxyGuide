import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronRight, Clock3, Globe, MapPin, Phone } from 'lucide-react';
import GlobalHeader from '../components/GlobalHeader';
import heroLocalImage from '../guides/JPN-USAA-TEM-001/hub/assets/hero-local.jpg';
import { ensureLanguageParam, getLanguageFromQuery, setLanguageInQuery } from '../utils/languageUtils';
import { type Language } from '../types';
import './BasicInfo.css';

type BasicInfoText = {
    pageTitle: string;
    locationName: string;
    address: string;
    website: string;
    phone: string;
    hoursPrimary: string;
    hoursSecondary: string;
    aboutTitle: string;
    paragraphs: string[];
};

const BASIC_INFO_TEXT: Record<Language, BasicInfoText> = {
    'en-US': {
        pageTitle: 'Basic Information',
        locationName: 'Usa Jingu Shrine',
        address: '2859 Minamiusa, Usa City, Oita Prefecture',
        website: 'usajingu.com',
        phone: '+81-978-37-0001',
        hoursPrimary: '6:00-18:00',
        hoursSecondary: 'Prayer reception: 9:00-16:00',
        aboutTitle: 'About Usa Jingu',
        paragraphs: [
            'Hachimansama has long been cherished and worshiped by many people.',
            'Of approximately 110,000 shrines in Japan, Hachiman shrines are the most numerous, with more than 46,000 sanctuaries.',
            'Usa Jingu is the head shrine of the more than 40,000 Hachiman shrines nationwide.'
        ]
    },
    'ja-JP': {
        pageTitle: '基本情報',
        locationName: '宇佐神宮',
        address: '大分県宇佐市南宇佐2859',
        website: 'usajingu.com',
        phone: '+81978-37-0001',
        hoursPrimary: '6:00〜18:00',
        hoursSecondary: '祈祷の受付は9時〜16時',
        aboutTitle: '宇佐神宮について',
        paragraphs: [
            '八幡さまは古くより多くの人々に親しまれ、お祀りされてきました。',
            '全国約11万社の神社のうち、八幡さまが最も多く、4万6000社あまりのお社(やしろ)があります。',
            '宇佐神宮は4万社あまりある八幡さまの総本宮です。'
        ]
    },
    'ko-KR': {
        pageTitle: '기본 정보',
        locationName: '우사 신궁',
        address: '오이타현 우사시 미나미우사 2859',
        website: 'usajingu.com',
        phone: '+81-978-37-0001',
        hoursPrimary: '6:00-18:00',
        hoursSecondary: '기도 접수: 9:00-16:00',
        aboutTitle: '우사 신궁 소개',
        paragraphs: [
            '하치만 신은 오래전부터 많은 사람들에게 사랑받고 모셔져 왔습니다.',
            '일본 전국 약 11만 개 신사 가운데 하치만 신사가 가장 많으며, 4만 6000여 개에 이릅니다.',
            '우사 신궁은 전국 4만여 하치만 신사의 총본궁입니다.'
        ]
    },
    'zh-TW': {
        pageTitle: '基本資訊',
        locationName: '宇佐神宮',
        address: '大分縣宇佐市南宇佐2859',
        website: 'usajingu.com',
        phone: '+81-978-37-0001',
        hoursPrimary: '6:00-18:00',
        hoursSecondary: '祈禱受理時間: 9:00-16:00',
        aboutTitle: '關於宇佐神宮',
        paragraphs: [
            '八幡神自古以來深受眾人敬仰與親近。',
            '在全日本約11萬座神社中，八幡神社數量最多，超過4萬6000座。',
            '宇佐神宮是全國超過4萬座八幡神社的總本宮。'
        ]
    },
    'zh-CN': {
        pageTitle: '基本信息',
        locationName: '宇佐神宫',
        address: '大分县宇佐市南宇佐2859',
        website: 'usajingu.com',
        phone: '+81-978-37-0001',
        hoursPrimary: '6:00-18:00',
        hoursSecondary: '祈祷受理时间: 9:00-16:00',
        aboutTitle: '关于宇佐神宫',
        paragraphs: [
            '八幡神自古以来深受众人敬仰与亲近。',
            '在日本全国约11万座神社中，八幡神社数量最多，超过4万6000座。',
            '宇佐神宫是全国4万多座八幡神社的总本宫。'
        ]
    },
    'fr-FR': {
        pageTitle: 'Informations de base',
        locationName: 'Sanctuaire Usa Jingu',
        address: '2859 Minamiusa, ville d\'Usa, prefecture d\'Oita',
        website: 'usajingu.com',
        phone: '+81-978-37-0001',
        hoursPrimary: '6:00-18:00',
        hoursSecondary: 'Accueil des prieres: 9:00-16:00',
        aboutTitle: 'A propos d\'Usa Jingu',
        paragraphs: [
            'Hachimansama est venere et apprecie par de nombreuses personnes depuis les temps anciens.',
            'Parmi environ 110 000 sanctuaires au Japon, les sanctuaires Hachiman sont les plus nombreux, avec plus de 46 000 sanctuaires.',
            'Usa Jingu est le sanctuaire principal de plus de 40 000 sanctuaires Hachiman a travers le pays.'
        ]
    }
};

const BasicInfo: React.FC = () => {
    const navigate = useNavigate();
    const { guideId } = useParams<{ guideId: string }>();
    const [searchParams, setSearchParams] = useSearchParams();

    useEffect(() => {
        const defaultLang = ensureLanguageParam(searchParams);
        if (defaultLang) {
            setSearchParams(setLanguageInQuery(searchParams, defaultLang), { replace: true });
        }
    }, [searchParams, setSearchParams]);

    const lang = getLanguageFromQuery(searchParams);
    const content = BASIC_INFO_TEXT[lang] || BASIC_INFO_TEXT['en-US'];
    const mapUrl = `https://maps.google.com/?q=${encodeURIComponent(content.address)}`;

    return (
        <div className="page basic-info-page">
            <Helmet>
                <title>{`${content.locationName} | ${content.pageTitle}`}</title>
                <meta name="description" content={content.aboutTitle} />
                <meta property="og:title" content={`${content.locationName} | ${content.pageTitle}`} />
                <meta property="og:description" content={content.aboutTitle} />
                <meta property="og:image" content={heroLocalImage} />
                <meta property="og:type" content="website" />
            </Helmet>

            <div className="basic-info-header">
                <GlobalHeader
                    title={content.pageTitle}
                    showBack={true}
                    onBack={() => navigate(`/${guideId}?${searchParams.toString()}`)}
                />
            </div>

            <div className="scroll-content basic-info-scroll">

                <main className="basic-info-content">
                    <img src={heroLocalImage} alt={content.locationName} className="basic-info-hero" />

                    <h2 className="basic-info-title">{content.locationName}</h2>

                    <section className="basic-info-meta" aria-label="Contact info">
                        <a className="basic-info-row" href={mapUrl} target="_blank" rel="noreferrer">
                            <span className="basic-info-row-left">
                                <MapPin size={20} strokeWidth={2.2} />
                                <span>{content.address}</span>
                            </span>
                            <ChevronRight size={18} strokeWidth={2.4} />
                        </a>

                        <a className="basic-info-row" href={`https://${content.website}`} target="_blank" rel="noreferrer">
                            <span className="basic-info-row-left">
                                <Globe size={20} strokeWidth={2.2} />
                                <span>{content.website}</span>
                            </span>
                        </a>

                        <a className="basic-info-row" href={`tel:${content.phone}`}>
                            <span className="basic-info-row-left">
                                <Phone size={20} strokeWidth={2.2} />
                                <span>{content.phone}</span>
                            </span>
                        </a>

                        <div className="basic-info-row basic-info-row--hours">
                            <span className="basic-info-row-left">
                                <Clock3 size={20} strokeWidth={2.2} />
                                <span>
                                    <strong>{content.hoursPrimary}</strong>
                                    <small>{content.hoursSecondary}</small>
                                </span>
                            </span>
                        </div>
                    </section>

                    <section className="basic-info-about">
                        <h3>{content.aboutTitle}</h3>
                        {content.paragraphs.map((paragraph) => (
                            <p key={paragraph}>{paragraph}</p>
                        ))}
                    </section>
                </main>
            </div>
        </div>
    );
};

export default BasicInfo;
