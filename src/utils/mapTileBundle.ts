import JSZip from 'jszip';

const MAP_TILE_BUNDLE_MANIFEST = 'manifest.json';
export const CURRENT_MAP_LABEL_LANGUAGE = 'ja-JP';

export interface MapTileBundleManifest {
    schemaVersion: 1 | 2;
    guideId: string;
    createdAt?: string;
    mapPixelWidth: number;
    mapPixelHeight: number;
    mapTileMaxZoom: number;
    tilePathTemplate: string;
    labelTilePathTemplates?: Record<string, string>;
    mapImageFile?: string;
}

export interface ResolvedMapTileBundle {
    manifest: MapTileBundleManifest;
    mapImageUrl?: string;
    tileUrlByPath: Record<string, string>;
}

const bundleCache = new Map<string, Promise<ResolvedMapTileBundle>>();

function normalizePath(value: string): string {
    return value.replace(/^\.?\//, '').replace(/^\/+/, '');
}

function inferImageMimeType(fileName: string): string | null {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.gif')) return 'image/gif';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    return null;
}

function findTilePathTemplate(fileNames: string[]): string | null {
    for (const fileName of fileNames) {
        const normalized = normalizePath(fileName);
        const match = normalized.match(/^(.*?)(\d+)\/(\d+)\/(\d+)\.(png|webp|gif|jpg|jpeg)$/i);
        if (!match) continue;
        const prefix = match[1] || '';
        const ext = match[5];
        return `${prefix}{z}/{x}/{y}.${ext}`;
    }
    return null;
}

function findStandaloneImageEntry(fileNames: string[]): string | undefined {
    return fileNames.find((fileName) => {
        const normalized = normalizePath(fileName);
        if (normalized.includes('/')) {
            return normalized.startsWith('map-image.');
        }
        return /^map-image\.(png|webp|gif|jpg|jpeg)$/i.test(normalized);
    });
}

function buildTilePath(template: string, z: number, x: number, y: number): string {
    return normalizePath(
        template
            .replace('{z}', String(z))
            .replace('{x}', String(x))
            .replace('{y}', String(y))
    );
}

function createTilePathMatcher(template: string): RegExp {
    const normalized = normalizePath(template);
    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(
        `^${escaped
            .replace('\\{z\\}', '(\\d+)')
            .replace('\\{x\\}', '(\\d+)')
            .replace('\\{y\\}', '(\\d+)')}$`,
        'i'
    );
}

export function resolveBundledTileUrl(
    bundle: ResolvedMapTileBundle,
    z: number,
    x: number,
    y: number
): string | undefined {
    const path = buildTilePath(bundle.manifest.tilePathTemplate, z, x, y);
    return bundle.tileUrlByPath[path];
}

export function resolveBundledLabelTileUrl(
    bundle: ResolvedMapTileBundle,
    _language: string,
    z: number,
    x: number,
    y: number
): string | undefined {
    const templates = bundle.manifest.labelTilePathTemplates;
    if (!templates) return undefined;

    // Temporarily use the Japanese artwork for every interface language.
    const normalizedLanguage = CURRENT_MAP_LABEL_LANGUAGE.toLowerCase();
    const templateEntry = Object.entries(templates).find(([candidate]) => (
        candidate.toLowerCase() === normalizedLanguage
    ));
    if (!templateEntry) return undefined;

    return bundle.tileUrlByPath[buildTilePath(templateEntry[1], z, x, y)];
}

async function readBundleBytes(bundleUrl: string): Promise<ArrayBuffer> {
    const response = await fetch(bundleUrl, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`Failed to download map tile bundle (${response.status})`);
    }

    const bytes = await response.arrayBuffer();
    if (!bytes || bytes.byteLength === 0) {
        throw new Error('Downloaded map tile bundle is empty');
    }

    const header = new Uint8Array(bytes, 0, Math.min(4, bytes.byteLength));
    const isZip = header.length >= 2 && header[0] === 0x50 && header[1] === 0x4b;
    if (!isZip) {
        throw new Error('Downloaded map tile bundle is not a valid ZIP');
    }

    return bytes;
}

async function blobToObjectUrl(blob: Blob, fileName: string): Promise<string> {
    const inferredType = inferImageMimeType(fileName);
    if (inferredType && !blob.type.startsWith('image/')) {
        return URL.createObjectURL(new Blob([blob], { type: inferredType }));
    }
    return URL.createObjectURL(blob);
}

export async function loadMapTileBundle(
    bundleUrl: string,
    expectedGuideId: string,
    fallback?: {
        mapPixelWidth?: number;
        mapPixelHeight?: number;
        mapTileMaxZoom?: number;
    }
): Promise<ResolvedMapTileBundle> {
    const cacheKey = `${expectedGuideId}::${bundleUrl}`;
    const cached = bundleCache.get(cacheKey);
    if (cached) return cached;

    const pending = (async () => {
        const bytes = await readBundleBytes(bundleUrl);
        const zip = await JSZip.loadAsync(bytes);
        const fileNames = Object.keys(zip.files).filter((fileName) => !zip.files[fileName]?.dir);

        const manifestEntry = zip.file(MAP_TILE_BUNDLE_MANIFEST);
        const manifestRaw = await manifestEntry?.async('string');
        const parsedManifest = manifestRaw
            ? (JSON.parse(manifestRaw) as Partial<MapTileBundleManifest>)
            : null;

        if (parsedManifest?.guideId && parsedManifest.guideId !== expectedGuideId) {
            throw new Error('Map tile bundle guide does not match current guide');
        }

        const tilePathTemplate = parsedManifest?.tilePathTemplate || findTilePathTemplate(fileNames);
        if (!tilePathTemplate) {
            throw new Error('Map tile bundle does not contain a tile path template');
        }
        const labelTilePathTemplates = Object.fromEntries(
            Object.entries(parsedManifest?.labelTilePathTemplates ?? {})
                .filter(([language, template]) => Boolean(language) && typeof template === 'string' && template.length > 0)
        );
        const tilePathMatchers = [
            createTilePathMatcher(tilePathTemplate),
            ...Object.values(labelTilePathTemplates).map(createTilePathMatcher)
        ];

        const mapPixelWidth = Number(parsedManifest?.mapPixelWidth ?? fallback?.mapPixelWidth);
        const mapPixelHeight = Number(parsedManifest?.mapPixelHeight ?? fallback?.mapPixelHeight);
        const mapTileMaxZoom = Number(parsedManifest?.mapTileMaxZoom ?? fallback?.mapTileMaxZoom);
        if (!Number.isFinite(mapPixelWidth) || !Number.isFinite(mapPixelHeight) || !Number.isFinite(mapTileMaxZoom)) {
            throw new Error('Map tile bundle is missing required map dimensions');
        }

        const tileUrlByPath: Record<string, string> = {};
        for (const fileName of fileNames) {
            const normalized = normalizePath(fileName);
            if (!tilePathMatchers.some((matcher) => matcher.test(normalized))) continue;

            const blob = await zip.file(fileName)?.async('blob');
            if (!blob) continue;
            tileUrlByPath[normalized] = await blobToObjectUrl(blob, fileName);
        }

        const manifest: MapTileBundleManifest = {
            schemaVersion: parsedManifest?.schemaVersion === 2 ? 2 : 1,
            guideId: parsedManifest?.guideId || expectedGuideId,
            createdAt: parsedManifest?.createdAt,
            mapPixelWidth,
            mapPixelHeight,
            mapTileMaxZoom,
            tilePathTemplate,
            ...(Object.keys(labelTilePathTemplates).length > 0 ? { labelTilePathTemplates } : {})
        };

        let mapImageUrl: string | undefined;
        const imageEntryName = parsedManifest?.mapImageFile || findStandaloneImageEntry(fileNames);
        if (imageEntryName) {
            const imageBlob = await zip.file(imageEntryName)?.async('blob');
            if (imageBlob) {
                mapImageUrl = await blobToObjectUrl(imageBlob, imageEntryName);
                manifest.mapImageFile = imageEntryName;
            }
        }

        return {
            manifest,
            mapImageUrl,
            tileUrlByPath
        };
    })();

    bundleCache.set(cacheKey, pending);
    try {
        return await pending;
    } catch (error) {
        bundleCache.delete(cacheKey);
        throw error;
    }
}
