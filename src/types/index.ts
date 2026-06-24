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
    mapTileBundleUrl?: string;
    mapTileMaxZoom?: number;
    mapPixelWidth?: number;
    mapPixelHeight?: number;
    mapPinsUrl?: string;
    geoCalibration?: GeoCalibration;
    pois: POI[];
}

export interface GeoCalibrationPoint {
    id: string;
    x: number;
    y: number;
    lat: number;
    lng: number;
    label?: string;
}

export type GeoCalibrationCornerName = 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft';

export interface GeoCalibrationTransform {
    lat: [number, number, number];
    lng: [number, number, number];
}

export interface GeoCalibrationCornerTransform {
    topLeft: { lat: number; lng: number };
    topRight: { lat: number; lng: number };
    bottomRight: { lat: number; lng: number };
    bottomLeft: { lat: number; lng: number };
}

export interface GeoCalibrationAffine {
    method: 'affine';
    points: GeoCalibrationPoint[];
    transform: GeoCalibrationTransform;
    rmsErrorMeters?: number;
    maxErrorMeters?: number;
    createdAt?: string;
    updatedAt?: string;
}

export interface GeoCalibrationCornerBilinear {
    method: 'corner-bilinear';
    points: GeoCalibrationPoint[];
    transform: GeoCalibrationCornerTransform;
    createdAt?: string;
    updatedAt?: string;
}

export type GeoCalibration = GeoCalibrationAffine | GeoCalibrationCornerBilinear;

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

export interface TraversableRegionPoint {
    lat: number;
    lng: number;
}

export interface TraversableRegionNormalizedPoint {
    x: number;
    y: number;
}

export interface TraversableRegion {
    id: string;
    polygon: TraversableRegionPoint[];
    polygonNormalized?: TraversableRegionNormalizedPoint[];
    geoPolygon?: TraversableRegionPoint[];
}

export interface TraversableRegionsFile {
    version: number;
    guideId: string;
    regions: TraversableRegion[];
}

export interface RuntimeMapPin {
    id: string;
    x: number;
    y: number;
    geoPosition?: { lat: number; lng: number };
}

export interface DrawRuntimeData {
    guideId: string;
    calibration: GeoCalibration | null;
    traversableRegions: TraversableRegion[];
    pins: RuntimeMapPin[];
}

export interface MapAuthoringDocument {
    version: number;
    guideId: string;
    updatedAt: string;
    calibration: GeoCalibration | null;
    pins: MapPin[];
    traversableRegions: TraversableRegion[];
}

export interface MapDrawExportTraversableRegion {
    id: string;
    polygon: TraversableRegionPoint[];
}

export interface MapDrawExportPin {
    id: string;
    pinDisplayPosition: {
        x: number;
        y: number;
        geoPosition?: { lat: number; lng: number };
    };
    region: {
        polygon: TraversableRegionPoint[];
    };
}

export interface MapDrawExportPayload {
    version: 3;
    guideId: string;
    mapTileCorners: GeoCalibrationCornerTransform | null;
    calibration: GeoCalibration | null;
    traversableRegions: MapDrawExportTraversableRegion[];
    pins: MapDrawExportPin[];
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
