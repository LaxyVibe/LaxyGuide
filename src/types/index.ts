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
    mapImage?: string;
    mapTileUrlTemplate?: string;
    mapTileMaxZoom?: number;
    mapPixelWidth?: number;
    mapPixelHeight?: number;
    mapPinsUrl?: string;
    pois: POI[];
}

export interface MapPin {
    id: string;
    /** Editor-friendly name to display in UI (defaults to id if missing). */
    label?: string;
    /** Normalized X coordinate on the map image (0..1) */
    x: number;
    /** Normalized Y coordinate on the map image (0..1) */
    y: number;
    /** Clustered GPS points captured for this pin */
    latLngs?: Array<{ lat: number; lng: number; capturedAt?: string; seq?: number }>;

    /** Polygon vertices captured/edited on a real-world basemap. */
    polygon?: Array<{ lat: number; lng: number }>;

    /** Legacy single-point fields (v1). Kept optional for migration only. */
    lat?: number;
    lng?: number;
    createdAt?: string;
}

export interface MapPinsFile {
    version: number;
    guideId: string;
    pins: MapPin[];
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
