import matter from 'gray-matter';
import type {
    ContentManifest,
    GeoCalibration,
    GuideData,
    GuideManifestEntry,
    POI,
    PoiManifestEntry
} from '../types/index.ts';
import { normalizeGeoCalibration } from './geoTransform.ts';
import { isMapAuthoringEnabledGuide } from './mapDrawData.ts';
import { getMapTileBundlePublicUrl } from './mapStorage.ts';

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

type LocalizedRecord = Record<string, unknown>;

type EnvLikeImportMeta = ImportMeta & {
    env?: Record<string, string | undefined>;
};

export interface GuideSummary {
    id: string;
    title: string;
    image: string;
}

const DEFAULT_CONTENT_MANIFEST_URL = 'https://storage.googleapis.com/laxy-guide-dev.firebasestorage.app/content-manifest.json';

let manifestPromise: Promise<ContentManifest> | null = null;
const markdownCache = new Map<string, Promise<string>>();

function getContentManifestUrl(): string {
    const env = (import.meta as EnvLikeImportMeta).env;
    return String(env?.VITE_CONTENT_MANIFEST_URL || DEFAULT_CONTENT_MANIFEST_URL).trim() || DEFAULT_CONTENT_MANIFEST_URL;
}

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
}

function toLocalizedRecord(value: unknown): LocalizedRecord {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as LocalizedRecord
        : {};
}

async function fetchJson<T>(url: string, context: string): Promise<T> {
    let response: Response;
    try {
        response = await fetch(url, {
            method: 'GET',
            cache: 'no-store'
        });
    } catch (error) {
        throw new Error(`${context} request failed: ${getErrorMessage(error, 'Network error')}`);
    }

    if (!response.ok) {
        throw new Error(`${context} request failed (${response.status})`);
    }

    try {
        return await response.json() as T;
    } catch (error) {
        throw new Error(`${context} response was not valid JSON: ${getErrorMessage(error, 'Invalid JSON')}`);
    }
}

async function fetchText(url: string, context: string): Promise<string> {
    let response: Response;
    try {
        response = await fetch(url, {
            method: 'GET',
            cache: 'no-store'
        });
    } catch (error) {
        throw new Error(`${context} request failed: ${getErrorMessage(error, 'Network error')}`);
    }

    if (!response.ok) {
        throw new Error(`${context} request failed (${response.status})`);
    }

    return response.text();
}

function isGuideManifestEntry(entry: GuideManifestEntry): boolean {
    return typeof entry.guideId === 'string'
        && Array.isArray(entry.languages)
        && entry.languages.length > 0
        && !!entry.summaries
        && typeof entry.publicUrl === 'string';
}

function isPoiManifestEntry(entry: PoiManifestEntry): boolean {
    return typeof entry.guideId === 'string'
        && typeof entry.number === 'string'
        && Array.isArray(entry.languages)
        && entry.languages.length > 0
        && typeof entry.publicUrl === 'string';
}

async function loadManifest(): Promise<ContentManifest> {
    if (!manifestPromise) {
        const url = getContentManifestUrl();
        manifestPromise = fetchJson<ContentManifest>(url, 'Content manifest')
            .then((manifest) => {
                if (!manifest || !Array.isArray(manifest.guides) || !Array.isArray(manifest.pois)) {
                    throw new Error('Content manifest response is missing guides or pois arrays');
                }

                manifest.guides = manifest.guides.filter(isGuideManifestEntry);
                manifest.pois = manifest.pois.filter(isPoiManifestEntry);
                return manifest;
            })
            .catch((error) => {
                manifestPromise = null;
                throw error;
            });
    }

    return manifestPromise;
}

async function loadMarkdown(url: string, context: string): Promise<string> {
    const cached = markdownCache.get(url);
    if (cached) {
        return cached;
    }

    const request = fetchText(url, context).catch((error) => {
        markdownCache.delete(url);
        throw error;
    });

    markdownCache.set(url, request);
    return request;
}

function getGuideSummaryForLanguage(entry: GuideManifestEntry, lang: string) {
    return entry.summaries[lang] || entry.summaries['en-US'] || Object.values(entry.summaries)[0];
}

function findGuideEntry(manifest: ContentManifest, guideId: string): GuideManifestEntry | undefined {
    return manifest.guides.find((entry) => entry.guideId.toLowerCase() === guideId.toLowerCase());
}

function findPoiEntries(manifest: ContentManifest, guideId: string): PoiManifestEntry[] {
    return manifest.pois.filter((entry) => entry.guideId.toLowerCase() === guideId.toLowerCase());
}

export async function loadAllGuides(lang: string): Promise<GuideSummary[]> {
    const manifest = await loadManifest();

    return manifest.guides
        .map((entry) => {
            const summary = getGuideSummaryForLanguage(entry, lang);
            if (!summary || !summary.title) {
                return null;
            }

            return {
                id: entry.guideId,
                title: summary.title,
                image: summary.guideUnderlayImage || ''
            };
        })
        .filter((guide): guide is GuideSummary => guide !== null);
}

export async function loadGuideData(guideId: string, lang: string): Promise<GuideData | null> {
    const manifest = await loadManifest();
    const guideEntry = findGuideEntry(manifest, guideId);

    if (!guideEntry) {
        console.error(`No guide manifest entry found for guideId: ${guideId}`);
        return null;
    }

    const guideMarkdown = await loadMarkdown(guideEntry.publicUrl, `Guide markdown (${guideEntry.guideId})`);
    const guideParsed = matter(guideMarkdown);
    const guideData = guideParsed.data as GuideFrontmatter;

    const guideLangData = toLocalizedRecord(guideData[lang]);
    const guideDefaultData = toLocalizedRecord(guideData['en-US']);
    const isHostedAuthoringGuide = isMapAuthoringEnabledGuide(guideEntry.guideId);

    const guideTitle = String(guideLangData.title || guideDefaultData.title || '');
    const guideUnderlayImage = String(guideLangData.guideUnderlayImage || guideDefaultData.guideUnderlayImage || '');
    const mapImageValue = isHostedAuthoringGuide
        ? undefined
        : (guideLangData.mapImage || guideDefaultData.mapImage);
    const mapImage = typeof mapImageValue === 'string'
        ? String(mapImageValue)
        : undefined;
    const mapTileUrlTemplateValue = isHostedAuthoringGuide
        ? undefined
        : (guideLangData.mapTileUrlTemplate || guideDefaultData.mapTileUrlTemplate);
    const mapTileUrlTemplate = typeof mapTileUrlTemplateValue === 'string'
        ? String(mapTileUrlTemplateValue)
        : undefined;
    const explicitMapTileBundleValue = guideLangData.mapTileBundleUrl || guideDefaultData.mapTileBundleUrl;
    const explicitMapTileBundleUrl = typeof explicitMapTileBundleValue === 'string'
        ? String(explicitMapTileBundleValue)
        : undefined;
    const mapTileBundleUrl = isHostedAuthoringGuide
        ? getMapTileBundlePublicUrl(guideEntry.guideId)
        : explicitMapTileBundleUrl;
    const mapTileMaxZoomRaw = isHostedAuthoringGuide ? undefined : (guideLangData.mapTileMaxZoom ?? guideDefaultData.mapTileMaxZoom);
    const mapPixelWidthRaw = isHostedAuthoringGuide ? undefined : (guideLangData.mapPixelWidth ?? guideDefaultData.mapPixelWidth);
    const mapPixelHeightRaw = isHostedAuthoringGuide ? undefined : (guideLangData.mapPixelHeight ?? guideDefaultData.mapPixelHeight);
    const mapPinsUrlValue = isHostedAuthoringGuide ? undefined : (guideLangData.mapPinsUrl || guideDefaultData.mapPinsUrl);
    const mapPinsUrl = typeof mapPinsUrlValue === 'string'
        ? String(mapPinsUrlValue)
        : undefined;
    const geoCalibration = normalizeGeoCalibration(
        isHostedAuthoringGuide
            ? undefined
            : (guideLangData.geoCalibration ?? guideDefaultData.geoCalibration)
    );

    const mapTileMaxZoom = Number.isFinite(Number(mapTileMaxZoomRaw)) ? Number(mapTileMaxZoomRaw) : undefined;
    const mapPixelWidth = Number.isFinite(Number(mapPixelWidthRaw)) ? Number(mapPixelWidthRaw) : undefined;
    const mapPixelHeight = Number.isFinite(Number(mapPixelHeightRaw)) ? Number(mapPixelHeightRaw) : undefined;

    const poiEntries = findPoiEntries(manifest, guideEntry.guideId);
    const poiContents = await Promise.all(
        poiEntries.map(async (entry) => ({
            entry,
            markdown: await loadMarkdown(entry.publicUrl, `POI markdown (${entry.guideId}/${entry.number})`)
        }))
    );

    const pois: POI[] = [];

    for (const item of poiContents) {
        const poiParsed = matter(item.markdown);
        const poiData = poiParsed.data as POIFrontmatter;

        const poiLangData = toLocalizedRecord(poiData[lang]);
        const poiDefaultData = toLocalizedRecord(poiData['en-US']);
        const mergedPoi = { ...poiDefaultData, ...poiLangData };

        if (!mergedPoi.number) continue;

        const poiGuide = typeof mergedPoi.guide === 'string' ? mergedPoi.guide : item.entry.guideId;
        if (poiGuide && poiGuide.toLowerCase() !== guideEntry.guideId.toLowerCase()) {
            continue;
        }

        pois.push({
            number: String(mergedPoi.number),
            title: typeof mergedPoi.title === 'string' ? mergedPoi.title : '',
            hero: typeof mergedPoi.hero === 'string' ? mergedPoi.hero : '',
            withAudio: (!!mergedPoi.audio || !!mergedPoi.ttml) && (mergedPoi.displayAudio !== false),
            metadata: Array.isArray(mergedPoi.metadata) ? mergedPoi.metadata : [],
            content: typeof mergedPoi.content === 'string' ? mergedPoi.content : '',
            audio: typeof mergedPoi.audio === 'string' ? mergedPoi.audio : undefined,
            subtitle: typeof mergedPoi.subtitle === 'string' ? mergedPoi.subtitle : undefined,
            ttml: typeof mergedPoi.ttml === 'string' ? mergedPoi.ttml : undefined,
            displayAudio: mergedPoi.displayAudio !== false
        });
    }

    pois.sort((a, b) => {
        const numA = parseInt(a.number, 10);
        const numB = parseInt(b.number, 10);
        if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
            return numA - numB;
        }
        return a.number.localeCompare(b.number);
    });

    return {
        guideTitle,
        guideUnderlayImage,
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
    const manifest = await loadManifest();
    const guideEntry = findGuideEntry(manifest, guideId);
    return guideEntry?.languages || ['en-US'];
}

export function resetContentLoaderCachesForTests(): void {
    manifestPromise = null;
    markdownCache.clear();
}
