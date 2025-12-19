export interface MetadataItem {
    label: string;
    value: string;
}

export interface Subtitle {
    startTime: number;
    endTime: number;
    text: string;
}

export interface Slide {
    startTime: number;
    endTime: number;
    image: string;
}

export interface POI {
    number: string;
    title: string;
    hero: string;
    withAudio: boolean;
    metadata: MetadataItem[];
    content: string;
    audio?: string;
    subtitle?: string;
    ttml?: string;
    displayAudio?: boolean;
}

export interface GuideData {
    guideTitle: string;
    guideUnderlayImage: string;
    pois: POI[];
}

export type Language = 'en-US' | 'ja-JP' | 'ko-KR' | 'zh-TW' | 'zh-CN' | 'fr-FR';

export const LANGUAGES: { [key in Language]: string } = {
    'en-US': 'English',
    'ja-JP': '日本語',
    'ko-KR': '한국어',
    'zh-TW': '繁體中文',
    'zh-CN': '简体中文',
    'fr-FR': 'Français'
};
