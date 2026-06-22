import matter from 'gray-matter';
import type { GeoCalibration, GuideData, POI } from '../types';
import { normalizeGeoCalibration } from './geoTransform';

// Define interfaces for the raw frontmatter structure
interface GuideFrontmatter {
    [key: string]: {
        title?: string;
        code?: string;
        guideUnderlayImage?: string;
        mapImage?: string;
        mapTileUrlTemplate?: string;
        mapTileBundleUrl?: string;
        mapTileMaxZoom?: number;
        mapPixelWidth?: number;
        mapPixelHeight?: number;
        mapPinsUrl?: string;
        geoCalibration?: GeoCalibration;
        pois?: string[];
    } | string | undefined;
}

interface POIFrontmatter {
    [key: string]: {
        number?: string;
        title?: string;
        hero?: string;
        audio?: string;
        subtitle?: string;
        ttml?: string;
        displayAudio?: boolean;
        metadata?: { label: string; value: string }[];
        content?: string;
        guide?: string;
    } | string | undefined;
}

export interface GuideSummary {
    id: string;
    title: string;
    image: string;
}

export async function loadAllGuides(lang: string): Promise<GuideSummary[]> {
    const guideFiles = import.meta.glob('/src/content/guides/*.md', { eager: true, query: '?raw', import: 'default' });
    const guides: GuideSummary[] = [];

    for (const path in guideFiles) {
        const content = guideFiles[path] as string;
        const parsed = matter(content);
        const data = parsed.data as GuideFrontmatter;

        // Get guide details with fallback to en-US
        const guideLangData = (data[lang] as any) || {};
        const guideDefaultData = (data['en-US'] as any) || {};

        const title = guideLangData.title || guideDefaultData.title;
        const code = guideLangData.code || guideDefaultData.code;
        const image = guideLangData.guideUnderlayImage || guideDefaultData.guideUnderlayImage;

        if (code && title) {
            guides.push({
                id: code,
                title,
                image: image || ''
            });
        }
    }

    return guides;
}

export async function loadGuideData(guideId: string, lang: string): Promise<GuideData | null> {
    // 1. Load Guide Files
    const guideFiles = import.meta.glob('/src/content/guides/*.md', { eager: true, query: '?raw', import: 'default' });
    let guideContent: string | null = null;

    // Find the guide file that matches the guideId (case-insensitive for safety)
    for (const path in guideFiles) {
        const content = guideFiles[path] as string;
        const parsed = matter(content);
        const data = parsed.data as GuideFrontmatter;

        // Check if any language version has the matching code
        const hasMatchingCode = Object.values(data).some(langData =>
            langData && typeof langData === 'object' && 'code' in langData &&
            langData.code?.toLowerCase() === guideId.toLowerCase()
        );

        if (hasMatchingCode) {
            guideContent = content;
            break;
        }
    }

    if (!guideContent) {
        console.error(`No guide file found for guideId: ${guideId}`);
        return null;
    }

    const guideParsed = matter(guideContent);
    const guideData = guideParsed.data as GuideFrontmatter;

    // Get guide details with fallback to en-US
    const guideLangData = (guideData[lang] as any) || {};
    const guideDefaultData = (guideData['en-US'] as any) || {};

    const guideTitle = guideLangData.title || guideDefaultData.title;
    const guideUnderlayImage = guideLangData.guideUnderlayImage || guideDefaultData.guideUnderlayImage;
    const mapImage = guideLangData.mapImage || guideDefaultData.mapImage;
    const mapTileUrlTemplate = guideLangData.mapTileUrlTemplate || guideDefaultData.mapTileUrlTemplate;
    const mapTileBundleUrl = guideLangData.mapTileBundleUrl || guideDefaultData.mapTileBundleUrl;
    const mapTileMaxZoomRaw = guideLangData.mapTileMaxZoom ?? guideDefaultData.mapTileMaxZoom;
    const mapPixelWidthRaw = guideLangData.mapPixelWidth ?? guideDefaultData.mapPixelWidth;
    const mapPixelHeightRaw = guideLangData.mapPixelHeight ?? guideDefaultData.mapPixelHeight;
    const mapPinsUrl = guideLangData.mapPinsUrl || guideDefaultData.mapPinsUrl;
    const geoCalibration = normalizeGeoCalibration(guideLangData.geoCalibration ?? guideDefaultData.geoCalibration);

    const mapTileMaxZoom = Number.isFinite(Number(mapTileMaxZoomRaw)) ? Number(mapTileMaxZoomRaw) : undefined;
    const mapPixelWidth = Number.isFinite(Number(mapPixelWidthRaw)) ? Number(mapPixelWidthRaw) : undefined;
    const mapPixelHeight = Number.isFinite(Number(mapPixelHeightRaw)) ? Number(mapPixelHeightRaw) : undefined;

    // 2. Load POI Files
    const poiFiles = import.meta.glob('/src/content/pois/*.md', { eager: true, query: '?raw', import: 'default' });
    const pois: POI[] = [];

    for (const path in poiFiles) {
        const poiContent = poiFiles[path] as string;
        const poiParsed = matter(poiContent);
        const poiData = poiParsed.data as POIFrontmatter;

        const poiLangData = (poiData[lang] as any) || {};
        const poiDefaultData = (poiData['en-US'] as any) || {};

        // Merge data: default first, then localized override
        const mergedPoi = { ...poiDefaultData, ...poiLangData };

        if (!mergedPoi.number) continue;

        // Filter by guideId
        // If the POI doesn't have a guide field, or it matches the guideId
        const poiGuide = mergedPoi.guide;
        if (poiGuide && poiGuide.toLowerCase() !== guideId.toLowerCase()) {
            continue;
        }

        pois.push({
            number: String(mergedPoi.number),
            title: mergedPoi.title || '',
            hero: mergedPoi.hero || '',
            withAudio: (!!mergedPoi.audio || !!mergedPoi.ttml) && (mergedPoi.displayAudio !== false),
            metadata: mergedPoi.metadata || [],
            content: mergedPoi.content || '',
            audio: mergedPoi.audio,
            subtitle: mergedPoi.subtitle,
            ttml: mergedPoi.ttml,
            displayAudio: mergedPoi.displayAudio !== false
        });
    }

    // 3. Sort POIs by number
    pois.sort((a, b) => {
        const numA = parseInt(a.number, 10);
        const numB = parseInt(b.number, 10);
        if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB;
        }
        return a.number.localeCompare(b.number);
    });

    return {
        guideTitle: guideTitle || '',
        guideUnderlayImage: guideUnderlayImage || '',
        mapImage,
        mapTileUrlTemplate,
        mapTileBundleUrl,
        mapTileMaxZoom,
        mapPixelWidth,
        mapPixelHeight,
        mapPinsUrl,
        geoCalibration: geoCalibration ?? undefined,
        pois
    };
}

export async function getGuideAvailableLanguages(guideId: string): Promise<string[]> {
    const guideFiles = import.meta.glob('/src/content/guides/*.md', { eager: true, query: '?raw', import: 'default' });

    for (const path in guideFiles) {
        const content = guideFiles[path] as string;
        const parsed = matter(content);
        const data = parsed.data as GuideFrontmatter;

        // Check if any language version has the matching code
        const hasMatchingCode = Object.values(data).some(langData =>
            langData && typeof langData === 'object' && 'code' in langData &&
            langData.code?.toLowerCase() === guideId.toLowerCase()
        );

        if (hasMatchingCode) {
            // Return all language keys that have content (are objects with title)
            return Object.keys(data).filter(key => {
                const langData = data[key];
                return langData && typeof langData === 'object' && 'title' in langData;
            });
        }
    }

    return ['en-US']; // Default fallback
}
