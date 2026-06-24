import type {
    DrawRuntimeData,
    GeoCalibration,
    MapAuthoringDocument,
    MapPinsFile,
    RuntimeMapPin,
    TraversableRegion,
    TraversableRegionsFile
} from '../types';
import { normalizeGeoCalibration, transformNormalizedPoint } from './geoTransform.ts';
import { normalizePinsFile } from './mapPins.ts';

export const MAP_AUTHORING_DOCUMENT_VERSION = 1;
export const MAP_AUTHORING_ENABLED_GUIDE_IDS = ['JPN-USAA-TEM-001'] as const;
const TRAVERSABLE_REGIONS_VERSION = 1;

const MAP_AUTHORING_ENDPOINT = '/.netlify/functions/get-map-draw-json';
const MAP_AUTHORING_SAVE_ENDPOINT = '/.netlify/functions/upload-map-draw-json';

const readJson = async <T>(resp: Response): Promise<T> => {
    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
        const message = (data as { error?: string } | null)?.error || `Request failed (${resp.status})`;
        throw new Error(message);
    }

    return data as T;
};

const normalizeTraversableRegion = (region: unknown, index: number): TraversableRegion | null => {
    if (!region || typeof region !== 'object') return null;

    const item = region as Partial<TraversableRegion>;
    const id = typeof item.id === 'string' && item.id.trim()
        ? item.id.trim()
        : String(index + 1).padStart(3, '0');
    const polygon = Array.isArray(item.polygon)
        ? item.polygon
            .map((point) => ({
                lat: Number(point?.lat),
                lng: Number(point?.lng)
            }))
            .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
        : [];
    const polygonNormalized = Array.isArray(item.polygonNormalized)
        ? item.polygonNormalized
            .map((point) => ({
                x: Number(point?.x),
                y: Number(point?.y)
            }))
            .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
        : undefined;
    const geoPolygon = Array.isArray(item.geoPolygon)
        ? item.geoPolygon
            .map((point) => ({
                lat: Number(point?.lat),
                lng: Number(point?.lng)
            }))
            .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
        : undefined;

    return { id, polygon, polygonNormalized, geoPolygon };
};

function normalizeRuntimePins(file: Partial<MapPinsFile>, fallbackGuideId?: string, calibration?: GeoCalibration | null): RuntimeMapPin[] {
    const normalized = normalizePinsFile(file as MapPinsFile, fallbackGuideId);
    return normalized.pins.map((pin) => ({
        id: pin.id,
        x: pin.x,
        y: pin.y,
        geoPosition: calibration
            ? transformNormalizedPoint(calibration.transform, { x: pin.x, y: pin.y })
            : undefined
    }));
}

export function isMapAuthoringEnabledGuide(guideId?: string | null): boolean {
    if (!guideId) return false;

    const normalizedGuideId = guideId.trim().toUpperCase();
    return MAP_AUTHORING_ENABLED_GUIDE_IDS.some((item) => item.toUpperCase() === normalizedGuideId);
}

export function normalizeTraversableRegionsFile(file: Partial<TraversableRegionsFile>, fallbackGuideId?: string): TraversableRegionsFile {
    const guideId = typeof file.guideId === 'string' && file.guideId.trim()
        ? file.guideId.trim()
        : (fallbackGuideId ?? '');

    const regions = Array.isArray(file.regions)
        ? file.regions
            .map((region, index) => normalizeTraversableRegion(region, index))
            .filter((region): region is TraversableRegion => region !== null)
        : [];

    return {
        version: TRAVERSABLE_REGIONS_VERSION,
        guideId,
        regions
    };
}

export function normalizeMapAuthoringDocument(
    document: Partial<MapAuthoringDocument> | null | undefined,
    fallbackGuideId?: string
): MapAuthoringDocument {
    const guideId = typeof document?.guideId === 'string' && document.guideId.trim()
        ? document.guideId.trim()
        : (fallbackGuideId ?? '');
    const calibration = normalizeGeoCalibration(document?.calibration) ?? null;
    const pins = normalizePinsFile(
        {
            version: 2,
            guideId,
            pins: Array.isArray(document?.pins) ? document.pins : []
        },
        guideId
    ).pins;
    const traversableRegions = normalizeTraversableRegionsFile(
        {
            version: TRAVERSABLE_REGIONS_VERSION,
            guideId,
            regions: Array.isArray(document?.traversableRegions) ? document.traversableRegions : []
        },
        guideId
    ).regions;
    const updatedAt = typeof document?.updatedAt === 'string' && document.updatedAt.trim()
        ? document.updatedAt
        : new Date().toISOString();

    return {
        version: MAP_AUTHORING_DOCUMENT_VERSION,
        guideId,
        updatedAt,
        calibration,
        pins,
        traversableRegions
    };
}

export function createBootstrapMapAuthoringDocument(params: {
    guideId: string;
    calibration?: GeoCalibration | null;
    pins?: MapPinsFile | null;
    traversableRegions?: TraversableRegionsFile | null;
}): MapAuthoringDocument {
    return normalizeMapAuthoringDocument(
        {
            guideId: params.guideId,
            updatedAt: new Date().toISOString(),
            calibration: params.calibration ?? null,
            pins: params.pins?.pins ?? [],
            traversableRegions: params.traversableRegions?.regions ?? []
        },
        params.guideId
    );
}

export function buildRuntimePinsFromAuthoringDocument(document: MapAuthoringDocument): RuntimeMapPin[] {
    return normalizeRuntimePins(
        {
            version: 2,
            guideId: document.guideId,
            pins: document.pins
        },
        document.guideId,
        document.calibration
    );
}

export function buildDrawRuntimeFromAuthoringDocument(document: MapAuthoringDocument): DrawRuntimeData {
    return {
        guideId: document.guideId,
        calibration: document.calibration,
        traversableRegions: document.traversableRegions.filter((region) => (
            (Array.isArray(region.polygonNormalized) && region.polygonNormalized.length >= 3)
            || (Array.isArray(region.polygon) && region.polygon.length >= 3)
        )),
        pins: buildRuntimePinsFromAuthoringDocument(document)
    };
}

export async function fetchMapAuthoringJson(guideId: string): Promise<MapAuthoringDocument | null> {
    const params = new URLSearchParams({ guideId });
    const resp = await fetch(`${MAP_AUTHORING_ENDPOINT}?${params.toString()}`, {
        method: 'GET',
        cache: 'no-store'
    });

    if (resp.status === 404) {
        return null;
    }

    const data = await readJson<Partial<MapAuthoringDocument>>(resp);
    return normalizeMapAuthoringDocument(data, guideId);
}

export async function saveMapAuthoringJson(params: {
    guideId: string;
    payload: MapAuthoringDocument;
    idToken: string;
}): Promise<{ ok: true; path: string }> {
    const payload = normalizeMapAuthoringDocument(
        {
            ...params.payload,
            guideId: params.guideId,
            updatedAt: new Date().toISOString()
        },
        params.guideId
    );

    const resp = await fetch(MAP_AUTHORING_SAVE_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${params.idToken}`
        },
        body: JSON.stringify({
            guideId: params.guideId,
            payload
        })
    });

    return readJson<{ ok: true; path: string }>(resp);
}

// Deprecated no-op exports kept temporarily so legacy, currently unused pages still compile.
export function loadDrawPinsFromLocalStorage(_guideId: string): MapPinsFile | null {
    return null;
}

export function saveDrawPinsToLocalStorage(_guideId: string, _file: MapPinsFile): void {
    // Intentionally empty after Firebase cutover.
}

export function loadCalibrationFromLocalStorage(_guideId: string): GeoCalibration | null {
    return null;
}

export function saveCalibrationToLocalStorage(_guideId: string, _calibration: GeoCalibration | null): void {
    // Intentionally empty after Firebase cutover.
}

export function loadTraversableRegionsFromLocalStorage(_guideId: string): TraversableRegionsFile | null {
    return null;
}

export function saveTraversableRegionsToLocalStorage(_guideId: string, _file: TraversableRegionsFile): void {
    // Intentionally empty after Firebase cutover.
}

export function loadDrawRuntimeFromLocalStorage(_guideId: string): DrawRuntimeData | null {
    return null;
}
