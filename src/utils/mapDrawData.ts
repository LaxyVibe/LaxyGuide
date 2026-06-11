import type { DrawRuntimeData, GeoCalibration, MapPinsFile, RuntimeMapPin, TraversableRegion, TraversableRegionsFile } from '../types';
import { normalizeGeoCalibration, transformNormalizedPoint } from './geoTransform';
import { normalizePinsFile } from './mapPins';

const DRAW_PINS_PREFIX = 'mapPins_draw_';
const CALIBRATION_PREFIX = 'mapCalibration_draw_';
const TRAVERSABLE_REGIONS_PREFIX = 'mapTraversableRegions_draw_';
const TRAVERSABLE_REGIONS_VERSION = 1;

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

    return { id, polygon, polygonNormalized };
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

export function getDrawPinsStorageKey(guideId: string) {
    return `${DRAW_PINS_PREFIX}${guideId}`;
}

export function loadDrawPinsFromLocalStorage(guideId: string): MapPinsFile | null {
    try {
        const raw = localStorage.getItem(getDrawPinsStorageKey(guideId));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as MapPinsFile;
        if (!parsed || !Array.isArray(parsed.pins)) return null;
        return normalizePinsFile(parsed, guideId);
    } catch {
        return null;
    }
}

export function saveDrawPinsToLocalStorage(guideId: string, file: MapPinsFile) {
    localStorage.setItem(
        getDrawPinsStorageKey(guideId),
        JSON.stringify(normalizePinsFile(file, guideId))
    );
}

export function getCalibrationStorageKey(guideId: string) {
    return `${CALIBRATION_PREFIX}${guideId}`;
}

export function loadCalibrationFromLocalStorage(guideId: string): GeoCalibration | null {
    try {
        const raw = localStorage.getItem(getCalibrationStorageKey(guideId));
        if (!raw) return null;
        return normalizeGeoCalibration(JSON.parse(raw));
    } catch {
        return null;
    }
}

export function saveCalibrationToLocalStorage(guideId: string, calibration: GeoCalibration | null) {
    if (!calibration) {
        localStorage.removeItem(getCalibrationStorageKey(guideId));
        return;
    }
    localStorage.setItem(getCalibrationStorageKey(guideId), JSON.stringify(calibration));
}

export function getTraversableRegionsStorageKey(guideId: string) {
    return `${TRAVERSABLE_REGIONS_PREFIX}${guideId}`;
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

export function loadTraversableRegionsFromLocalStorage(guideId: string): TraversableRegionsFile | null {
    try {
        const raw = localStorage.getItem(getTraversableRegionsStorageKey(guideId));
        if (!raw) return null;
        return normalizeTraversableRegionsFile(JSON.parse(raw), guideId);
    } catch {
        return null;
    }
}

export function saveTraversableRegionsToLocalStorage(guideId: string, file: TraversableRegionsFile) {
    localStorage.setItem(
        getTraversableRegionsStorageKey(guideId),
        JSON.stringify(normalizeTraversableRegionsFile(file, guideId))
    );
}

export function loadDrawRuntimeFromLocalStorage(guideId: string): DrawRuntimeData | null {
    try {
        const rawPins = localStorage.getItem(getDrawPinsStorageKey(guideId));
        const rawCalibration = localStorage.getItem(getCalibrationStorageKey(guideId));
        const rawTraversableRegions = localStorage.getItem(getTraversableRegionsStorageKey(guideId));

        if (!rawPins && !rawCalibration && !rawTraversableRegions) {
            return null;
        }

        const calibration = rawCalibration ? loadCalibrationFromLocalStorage(guideId) : null;
        const traversableRegions = (rawTraversableRegions ? loadTraversableRegionsFromLocalStorage(guideId)?.regions : [])
            ?.filter((region) => (
                (Array.isArray(region.polygonNormalized) && region.polygonNormalized.length >= 3)
                || (Array.isArray(region.polygon) && region.polygon.length >= 3)
            )) ?? [];
        const pins = rawPins
            ? normalizeRuntimePins(JSON.parse(rawPins) as MapPinsFile, guideId, calibration)
            : [];

        return {
            guideId,
            calibration,
            traversableRegions,
            pins
        };
    } catch {
        return {
            guideId,
            calibration: null,
            traversableRegions: [],
            pins: []
        };
    }
}
